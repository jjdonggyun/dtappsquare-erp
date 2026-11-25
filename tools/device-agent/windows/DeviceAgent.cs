using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Security;
using System.Net.Sockets;
using System.Reflection;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Security.Principal;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: AssemblyTitle("DigitalSquare Device Agent")]
[assembly: AssemblyDescription("DigitalSquare ERP PC attendance verification agent")]
[assembly: AssemblyCompany("DigitalSquare")]
[assembly: AssemblyProduct("DigitalSquare Device Agent")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]
[assembly: System.Runtime.Versioning.TargetFramework(".NETFramework,Version=v4.8", FrameworkDisplayName = ".NET Framework 4.8")]

namespace DigitalSquare.DeviceAgent
{
    internal static class App
    {
        internal const string Version = "1.0.0";
        internal const string DefaultUrl = "https://192.168.1.109:3443";
        internal const int Port = 45873;
#if TEST
        internal static readonly string DirectoryPath = Path.Combine(Path.GetTempPath(), "DigitalSquare.Agent.Verification", Process.GetCurrentProcess().Id.ToString());
#else
        internal static readonly string DirectoryPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "DigitalSquare", "DeviceAgent");
#endif
        internal static readonly string ExePath = Path.Combine(DirectoryPath, "DigitalSquare.DeviceAgent.exe");
        internal static readonly string SettingsPath = Path.Combine(DirectoryPath, "settings.json");
        internal static readonly string StopEventName = "Local\\DigitalSquare.DeviceAgent.Stop." + WindowsIdentity.GetCurrent().User.Value;
        internal static readonly string MutexName = "Local\\DigitalSquare.DeviceAgent.Run." + WindowsIdentity.GetCurrent().User.Value;
        internal const string RunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";
        internal const string RunValue = "DigitalSquare Device Agent";

        internal static string Origin(string value)
        {
            Uri uri;
            if (!Uri.TryCreate(value.Trim(), UriKind.Absolute, out uri) || uri.Scheme != "https" ||
                uri.UserInfo.Length != 0 || uri.Query.Length != 0 || uri.Fragment.Length != 0 || uri.AbsolutePath != "/")
                throw new InvalidOperationException("ERP 주소는 https://192.168.1.109:3443처럼 HTTPS 주소로 입력해 주세요.");
            return uri.GetLeftPart(UriPartial.Authority);
        }

        internal static void SecureDirectory()
        {
            Directory.CreateDirectory(DirectoryPath);
            var user = WindowsIdentity.GetCurrent().User;
            var acl = new DirectorySecurity();
            acl.SetOwner(user);
            acl.SetAccessRuleProtection(true, false);
            foreach (var sid in new[] { user, new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null), new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid, null) })
                acl.AddAccessRule(new FileSystemAccessRule(sid, FileSystemRights.FullControl, InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit, PropagationFlags.None, AccessControlType.Allow));
            Directory.SetAccessControl(DirectoryPath, acl);
        }

        internal static void Log(string message)
        {
            try
            {
                if (!Directory.Exists(DirectoryPath)) return;
                var path = Path.Combine(DirectoryPath, "native-agent.log");
                if (File.Exists(path) && new FileInfo(path).Length > 512 * 1024)
                {
                    if (File.Exists(path + ".old")) File.Delete(path + ".old");
                    File.Move(path, path + ".old");
                }
                File.AppendAllText(path, DateTimeOffset.Now.ToString("o") + " " + message + Environment.NewLine, new UTF8Encoding(false));
            }
            catch { }
        }

        internal static bool PortInUse()
        {
            using (var client = new TcpClient())
            {
                try { return client.ConnectAsync(IPAddress.Loopback, Port).Wait(400); }
                catch (AggregateException) { return false; }
            }
        }

        internal static void StopOldAgent()
        {
            try { using (var signal = EventWaitHandle.OpenExisting(StopEventName)) signal.Set(); }
            catch (WaitHandleCannotBeOpenedException) { }
            for (int i = 0; i < 20 && PortInUse(); i++) Thread.Sleep(150);
            if (PortInUse()) throw new InvalidOperationException("기존 Agent가 45873 포트에서 실행 중입니다. 기존 Agent를 종료한 뒤 다시 설치해 주세요.");
        }
    }

    internal sealed class AgentSettings
    {
        public string ServerUrl { get; set; }
        public string DeviceId { get; set; }
        public string ProtectedToken { get; set; }
        public bool AutoStart { get; set; }
        private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("DigitalSquare.DeviceAgent.v1");

        internal static string Protect(string token)
        {
            var bytes = Encoding.UTF8.GetBytes(token);
            try { return Convert.ToBase64String(ProtectedData.Protect(bytes, Entropy, DataProtectionScope.CurrentUser)); }
            finally { Array.Clear(bytes, 0, bytes.Length); }
        }

        internal string Token()
        {
            var bytes = ProtectedData.Unprotect(Convert.FromBase64String(ProtectedToken), Entropy, DataProtectionScope.CurrentUser);
            try { return Encoding.UTF8.GetString(bytes); }
            finally { Array.Clear(bytes, 0, bytes.Length); }
        }

        internal static AgentSettings Load()
        {
            var settings = new JavaScriptSerializer().Deserialize<AgentSettings>(File.ReadAllText(App.SettingsPath, Encoding.UTF8));
            settings.ServerUrl = App.Origin(settings.ServerUrl);
            Guid id;
            if (!Guid.TryParseExact(settings.DeviceId, "D", out id) || id == Guid.Empty) throw new InvalidOperationException("장치 UUID 설정을 다시 확인해 주세요.");
            if (!Regex.IsMatch(settings.Token(), @"^[A-Za-z0-9_-]{32,256}$")) throw new InvalidOperationException("장치 토큰 설정을 다시 확인해 주세요.");
            return settings;
        }

        internal void Save()
        {
            var temp = App.SettingsPath + ".new";
            File.WriteAllText(temp, new JavaScriptSerializer().Serialize(this), new UTF8Encoding(false));
            if (File.Exists(App.SettingsPath)) File.Replace(temp, App.SettingsPath, null);
            else File.Move(temp, App.SettingsPath);
        }
    }

    internal static class CertificateTrust
    {
        internal static readonly X509Certificate2 CompanyRoot = LoadRoot();

        private static X509Certificate2 LoadRoot()
        {
            using (var resource = Assembly.GetExecutingAssembly().GetManifestResourceStream("CompanyRoot.cer"))
            using (var buffer = new MemoryStream())
            {
                if (resource == null) throw new InvalidOperationException("회사 인증서가 포함되지 않았습니다.");
                resource.CopyTo(buffer);
                return new X509Certificate2(buffer.ToArray());
            }
        }

        internal static string Fingerprint()
        {
            using (var sha = SHA256.Create()) return BitConverter.ToString(sha.ComputeHash(CompanyRoot.RawData)).Replace('-', ':');
        }

        internal static void Configure()
        {
            ServicePointManager.SecurityProtocol = SecurityProtocolType.SystemDefault;
            ServicePointManager.ServerCertificateValidationCallback = Validate;
        }

        private static bool Validate(object sender, X509Certificate certificate, X509Chain suppliedChain, SslPolicyErrors errors)
        {
            if (errors == SslPolicyErrors.None) return true;
            if (certificate == null || (errors & ~SslPolicyErrors.RemoteCertificateChainErrors) != 0) return false;
            using (var leaf = new X509Certificate2(certificate))
            using (var chain = new X509Chain())
            {
                chain.ChainPolicy.ExtraStore.Add(CompanyRoot);
                chain.ChainPolicy.VerificationFlags = X509VerificationFlags.AllowUnknownCertificateAuthority;
                chain.ChainPolicy.RevocationMode = X509RevocationMode.NoCheck;
                if (!chain.Build(leaf) || chain.ChainElements.Count < 2) return false;
                var root = chain.ChainElements[chain.ChainElements.Count - 1].Certificate;
                return Convert.ToBase64String(root.RawData) == Convert.ToBase64String(CompanyRoot.RawData);
            }
        }

        internal static void InstallForBrowser()
        {
            if (CompanyRoot.NotBefore.ToUniversalTime() > DateTime.UtcNow || CompanyRoot.NotAfter.ToUniversalTime() <= DateTime.UtcNow)
                throw new InvalidOperationException("회사 인증서의 유효기간을 확인해 주세요.");
            using (var store = new X509Store(StoreName.Root, StoreLocation.CurrentUser))
            {
                store.Open(OpenFlags.ReadWrite);
                if (store.Certificates.Find(X509FindType.FindByThumbprint, CompanyRoot.Thumbprint, false).Count == 0) store.Add(CompanyRoot);
            }
        }
    }

    internal static class ServerApi
    {
        internal static HttpClient Client()
        {
            return new HttpClient(new HttpClientHandler { AllowAutoRedirect = false, UseProxy = false }) { Timeout = TimeSpan.FromSeconds(15) };
        }

        internal static async Task Health(string origin)
        {
            using (var client = Client())
            using (var response = await client.GetAsync(origin + "/api/health"))
                if (!response.IsSuccessStatusCode) throw new InvalidOperationException("ERP HTTPS 상태 확인에 실패했습니다. 서버 주소와 서버 상태를 확인해 주세요.");
        }
    }

    internal sealed class ProofServer : IDisposable
    {
        private readonly AgentSettings settings;
        private readonly TcpListener listener;
        private readonly HttpClient http;
        private readonly SemaphoreSlim slots = new SemaphoreSlim(16);
        private volatile bool stopping;
        internal Action<bool> ProofCompleted;
        internal int Port { get { return ((IPEndPoint)listener.LocalEndpoint).Port; } }

        internal ProofServer(AgentSettings value, int port)
        {
            settings = value;
            listener = new TcpListener(IPAddress.Loopback, port);
            listener.ExclusiveAddressUse = true;
            http = ServerApi.Client();
        }

        internal void Start()
        {
            listener.Start(16);
            Task.Run(async delegate
            {
                while (!stopping)
                {
                    TcpClient client;
                    try { client = await listener.AcceptTcpClientAsync(); }
                    catch (ObjectDisposedException) { break; }
                    catch (SocketException) { if (stopping) break; throw; }
                    if (!slots.Wait(0)) { client.Close(); continue; }
                    ThreadPool.QueueUserWorkItem(delegate { try { Handle(client); } catch { } finally { slots.Release(); } });
                }
            });
        }

        private static void Reply(NetworkStream stream, int status, string origin, string body, bool preflight)
        {
            var payload = Encoding.UTF8.GetBytes(body);
            var header = new StringBuilder("HTTP/1.1 " + status + " Response\r\nConnection: close\r\nCache-Control: no-store\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: " + payload.Length + "\r\n");
            if (origin != null) header.Append("Access-Control-Allow-Origin: " + origin + "\r\nVary: Origin\r\n");
            if (preflight) header.Append("Access-Control-Allow-Methods: POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\n");
            header.Append("\r\n");
            var bytes = Encoding.ASCII.GetBytes(header.ToString());
            stream.Write(bytes, 0, bytes.Length);
            if (payload.Length > 0) stream.Write(payload, 0, payload.Length);
        }

        private void Handle(TcpClient client)
        {
            using (client)
            using (var stream = client.GetStream())
            {
                stream.WriteTimeout = 3000;
                string allowedOrigin = null;
                try
                {
                    var deadline = DateTime.UtcNow.AddSeconds(5);
                    var header = new List<byte>();
                    while (true)
                    {
                        int remaining = (int)(deadline - DateTime.UtcNow).TotalMilliseconds;
                        if (remaining <= 0 || header.Count >= 8192) throw new InvalidDataException();
                        stream.ReadTimeout = remaining;
                        int next = stream.ReadByte();
                        if (next < 0) return;
                        header.Add((byte)next);
                        int n = header.Count;
                        if (n >= 4 && header[n - 4] == 13 && header[n - 3] == 10 && header[n - 2] == 13 && header[n - 1] == 10) break;
                    }
                    var lines = Encoding.ASCII.GetString(header.ToArray()).Split(new[] { "\r\n" }, StringSplitOptions.None);
                    var first = lines[0].Split(' ');
                    if (first.Length != 3 || first[2] != "HTTP/1.1") throw new InvalidDataException();
                    var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                    for (int i = 1; i < lines.Length && lines[i].Length > 0; i++)
                    {
                        int separator = lines[i].IndexOf(':');
                        if (separator < 1) throw new InvalidDataException();
                        var name = lines[i].Substring(0, separator).Trim();
                        if (headers.ContainsKey(name)) throw new InvalidDataException();
                        headers.Add(name, lines[i].Substring(separator + 1).Trim());
                    }
                    string declaredLength;
                    int length = 0;
                    if (headers.ContainsKey("Transfer-Encoding") ||
                        (headers.TryGetValue("Content-Length", out declaredLength) && (!Int32.TryParse(declaredLength, out length) || length < 0 || length > 8192)))
                        throw new InvalidDataException();
                    var body = new byte[length];
                    int read = 0;
                    while (read < length)
                    {
                        int remaining = (int)(deadline - DateTime.UtcNow).TotalMilliseconds;
                        if (remaining <= 0) throw new InvalidDataException();
                        stream.ReadTimeout = remaining;
                        int n = stream.Read(body, read, length - read);
                        if (n == 0) throw new InvalidDataException();
                        read += n;
                    }
                    string origin, host;
                    if (!headers.TryGetValue("Origin", out origin) || origin != settings.ServerUrl ||
                        !headers.TryGetValue("Host", out host) || host != "127.0.0.1:" + Port)
                    { Reply(stream, 403, null, "{\"accepted\":false}", false); return; }
                    allowedOrigin = origin;
                    if (first[1] == "/health" && first[0] == "GET")
                    {
                        Reply(stream, 200, origin, new JavaScriptSerializer().Serialize(new { version = App.Version, device_id = settings.DeviceId, server_url = settings.ServerUrl }), false);
                        return;
                    }
                    if (first[1] != "/proof") { Reply(stream, 404, origin, "{\"accepted\":false}", false); return; }
                    if (first[0] == "OPTIONS") { Reply(stream, 204, origin, "", true); return; }
                    string contentType;
                    if (first[0] != "POST" ||
                        !headers.TryGetValue("Content-Type", out contentType) || !contentType.StartsWith("application/json", StringComparison.OrdinalIgnoreCase) ||
                        length < 1 || length > 1024)
                        throw new InvalidDataException();
                    var json = new JavaScriptSerializer();
                    var input = json.Deserialize<Dictionary<string, object>>(new UTF8Encoding(false, true).GetString(body));
                    object value;
                    Guid verification;
                    if (input == null || !input.TryGetValue("verification_id", out value) || !(value is string) || !Guid.TryParseExact((string)value, "D", out verification) || verification == Guid.Empty)
                        throw new InvalidDataException();
                    var nonce = new byte[24];
                    using (var random = RandomNumberGenerator.Create()) random.GetBytes(nonce);
                    var evidence = new
                    {
                        verification_id = verification.ToString("D"), device_id = settings.DeviceId, device_token = settings.Token(),
                        timestamp = DateTimeOffset.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"), nonce = BitConverter.ToString(nonce).Replace("-", "").ToLowerInvariant()
                    };
                    bool accepted = false;
                    using (var payload = new StringContent(json.Serialize(evidence), Encoding.UTF8, "application/json"))
                    using (var response = http.PostAsync(settings.ServerUrl + "/api/device-agent/attendance-proof", payload).GetAwaiter().GetResult())
                    {
                        if (response.IsSuccessStatusCode)
                        {
                            Dictionary<string, object> result;
                            try { result = json.Deserialize<Dictionary<string, object>>(response.Content.ReadAsStringAsync().GetAwaiter().GetResult()); }
                            catch (ArgumentException) { throw new InvalidOperationException("ERP returned an invalid proof response."); }
                            object data, flag;
                            var resultData = result != null && result.TryGetValue("data", out data) ? data as Dictionary<string, object> : null;
                            accepted = resultData != null && resultData.TryGetValue("accepted", out flag) && flag is bool && (bool)flag;
                        }
                    }
                    Reply(stream, accepted ? 200 : 403, origin, accepted ? "{\"accepted\":true}" : "{\"accepted\":false}", false);
                    if (ProofCompleted != null) ProofCompleted(accepted);
                    App.Log(accepted ? "Device proof accepted." : "Device proof rejected by ERP.");
                }
                catch (InvalidDataException) { try { Reply(stream, 400, allowedOrigin, "{\"accepted\":false}", false); } catch { } }
                catch (ArgumentException) { try { Reply(stream, 400, allowedOrigin, "{\"accepted\":false}", false); } catch { } }
                catch (Exception error)
                {
                    App.Log("Proof request failed: " + error.GetType().Name);
                    try { Reply(stream, 502, allowedOrigin, "{\"accepted\":false}", false); } catch { }
                }
            }
        }

        public void Dispose() { stopping = true; listener.Stop(); http.Dispose(); }
    }

    internal sealed class AgentContext : ApplicationContext
    {
        private readonly Mutex mutex;
        private readonly EventWaitHandle stop;
        private readonly RegisteredWaitHandle wait;
        private readonly NotifyIcon tray;
        private readonly ProofServer server;
        private readonly Control dispatcher;

        internal AgentContext()
        {
            bool created;
            mutex = new Mutex(true, App.MutexName, out created);
            if (!created) throw new InvalidOperationException("Agent가 이미 실행 중입니다.");
            var settings = AgentSettings.Load();
            dispatcher = new Control();
            dispatcher.CreateControl();
            stop = new EventWaitHandle(false, EventResetMode.AutoReset, App.StopEventName);
            wait = ThreadPool.RegisterWaitForSingleObject(stop, delegate { try { dispatcher.BeginInvoke(new Action(ExitThread)); } catch { } }, null, Timeout.Infinite, true);
            var menu = new ContextMenuStrip();
            menu.Items.Add("ERP 열기", null, delegate { Process.Start(settings.ServerUrl); });
            menu.Items.Add("설정 변경", null, delegate { Process.Start(new ProcessStartInfo(App.ExePath, "--configure") { UseShellExecute = true }); });
            menu.Items.Add("종료", null, delegate { ExitThread(); });
            tray = new NotifyIcon { Icon = SystemIcons.Shield, Text = "DigitalSquare Agent · 기기 확인 대기", ContextMenuStrip = menu, Visible = true };
            server = new ProofServer(settings, App.Port);
            server.ProofCompleted = delegate(bool accepted)
            {
                try { dispatcher.BeginInvoke(new Action(delegate { tray.Text = accepted ? "DigitalSquare Agent · 기기 확인 완료" : "DigitalSquare Agent · 기기 확인 거절"; })); } catch { }
            };
            server.Start();
            App.Log("Native Agent " + App.Version + " started on 127.0.0.1:45873.");
        }

        protected override void ExitThreadCore()
        {
            server.Dispose();
            tray.Visible = false; tray.Dispose();
            wait.Unregister(null); stop.Dispose();
            dispatcher.Dispose(); mutex.ReleaseMutex(); mutex.Dispose();
            base.ExitThreadCore();
        }
    }

    internal sealed class SetupForm : Form
    {
        private readonly TextBox serverUrl = new TextBox();
        private readonly TextBox deviceId = new TextBox();
        private readonly TextBox token = new TextBox();
        private readonly CheckBox autoStart = new CheckBox();
        private readonly Button install = new Button();
        private readonly Button open = new Button();
        private readonly Label status = new Label();
        private bool working;

        internal SetupForm(bool loadExisting)
        {
            Text = "DigitalSquare · PC 연결";
            Font = new Font("맑은 고딕", 10F);
            AutoScaleDimensions = new SizeF(96F, 96F);
            AutoScaleMode = AutoScaleMode.Dpi;
            ClientSize = new Size(650, 622);
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.White;
            Icon = SystemIcons.Shield;
            AddLabel("DIGITALSQUARE", 30, 22, 580, 22, 9F, Color.FromArgb(45, 91, 170));
            AddLabel("회사 PC를 연결하세요", 28, 55, 590, 60, 22F, Color.FromArgb(14, 34, 61));
            AddLabel("ERP에 등록한 장치 정보를 입력하면 출퇴근 검증을 준비합니다.", 30, 125, 590, 30, 10F, Color.FromArgb(83, 98, 116));
            AddLabel("ERP 서버 주소", 30, 169, 580, 23, 10F, Color.FromArgb(32, 48, 70));
            ConfigureInput(serverUrl, 197); serverUrl.Text = App.DefaultUrl;
            AddLabel("장치 UUID", 30, 245, 580, 23, 10F, Color.FromArgb(32, 48, 70));
            ConfigureInput(deviceId, 273);
            AddLabel("장치관리 화면의 Hostname 아래 표시된 UUID를 붙여넣으세요.", 30, 311, 580, 22, 9F, Color.FromArgb(100, 111, 125));
            AddLabel("Device Agent 토큰", 30, 349, 580, 23, 10F, Color.FromArgb(32, 48, 70));
            ConfigureInput(token, 377); token.UseSystemPasswordChar = true;
            AddLabel("장치 등록 직후 발급된 원본 토큰을 입력하세요.", 30, 415, 580, 22, 9F, Color.FromArgb(100, 111, 125));
            autoStart.Text = "Windows 로그인 시 자동 실행";
            autoStart.SetBounds(30, 454, 420, 27); autoStart.Checked = true; Controls.Add(autoStart);
            var certificate = new LinkLabel { Text = "포함된 회사 인증서 정보", AutoSize = true, Location = new Point(31, 494), LinkColor = Color.FromArgb(45, 91, 170) };
            certificate.LinkClicked += delegate { MessageBox.Show(this, CertificateTrust.CompanyRoot.Subject + "\n\nSHA-256\n" + CertificateTrust.Fingerprint() + "\n\n유효기간: " + CertificateTrust.CompanyRoot.NotAfter.ToString("yyyy-MM-dd"), "회사 인증서", MessageBoxButtons.OK, MessageBoxIcon.Information); };
            Controls.Add(certificate);
            install.Text = "설치하고 연결"; install.SetBounds(414, 483, 206, 44); install.FlatStyle = FlatStyle.Flat;
            install.BackColor = Color.FromArgb(28, 76, 143); install.ForeColor = Color.White; install.FlatAppearance.BorderSize = 0;
            install.Click += async delegate { await Install(); }; Controls.Add(install);
            status.SetBounds(30, 544, 435, 62); status.ForeColor = Color.FromArgb(83, 98, 116);
            status.Text = "회사 인증서 등록과 PC 연결 설정을 함께 적용합니다."; Controls.Add(status);
            open.Text = "ERP 열기"; open.SetBounds(480, 570, 140, 34); open.Visible = false;
            open.Click += delegate { Process.Start(App.Origin(serverUrl.Text)); }; Controls.Add(open);
            FormClosing += delegate(object sender, FormClosingEventArgs e) { if (working) e.Cancel = true; };
            if (loadExisting && File.Exists(App.SettingsPath))
            {
                try
                {
                    var existing = AgentSettings.Load();
                    serverUrl.Text = existing.ServerUrl; deviceId.Text = existing.DeviceId; token.Text = existing.Token(); autoStart.Checked = existing.AutoStart;
                }
                catch { status.Text = "기존 설정을 읽지 못했습니다. 장치 정보와 토큰을 다시 입력해 주세요."; }
            }
            ActiveControl = deviceId;
        }

        private void AddLabel(string text, int x, int y, int width, int height, float size, Color color)
        {
            Controls.Add(new Label { Text = text, Bounds = new Rectangle(x, y, width, height), Font = new Font("맑은 고딕", size, size >= 20 ? FontStyle.Bold : FontStyle.Regular), ForeColor = color });
        }

        private void ConfigureInput(TextBox input, int y) { input.SetBounds(30, y, 590, 30); input.Font = new Font("Segoe UI", 11F); Controls.Add(input); }

        private async Task Install()
        {
            if (working) return;
            try
            {
                var origin = App.Origin(serverUrl.Text);
                Guid id;
                if (!Guid.TryParseExact(deviceId.Text.Trim(), "D", out id) || id == Guid.Empty) throw new InvalidOperationException("장치관리 화면에 표시된 Device UUID를 입력해 주세요.");
                if (!Regex.IsMatch(token.Text.Trim(), @"^[A-Za-z0-9_-]{32,256}$")) throw new InvalidOperationException("등록 직후 발급된 Device Agent 토큰을 입력해 주세요.");
                working = true; install.Enabled = false; open.Visible = false;
                status.ForeColor = Color.FromArgb(83, 98, 116); status.Text = "ERP HTTPS 연결을 확인하고 있습니다…";
                await ServerApi.Health(origin);
                status.Text = "회사 인증서와 자동 실행을 설정하고 있습니다…";
                await Task.Run(new Action(App.StopOldAgent));
                CertificateTrust.InstallForBrowser();
                App.SecureDirectory();
                var source = Assembly.GetExecutingAssembly().Location;
                if (!String.Equals(Path.GetFullPath(source), Path.GetFullPath(App.ExePath), StringComparison.OrdinalIgnoreCase))
                {
                    for (int attempt = 0; ; attempt++)
                    {
                        try { File.Copy(source, App.ExePath, true); break; }
                        catch (IOException) { if (attempt >= 15) throw; }
                        await Task.Delay(200);
                    }
                }
                var settings = new AgentSettings { ServerUrl = origin, DeviceId = id.ToString("D"), ProtectedToken = AgentSettings.Protect(token.Text.Trim()), AutoStart = autoStart.Checked };
                settings.Save();
                using (var run = Registry.CurrentUser.CreateSubKey(App.RunKey))
                {
                    if (settings.AutoStart) run.SetValue(App.RunValue, "\"" + App.ExePath + "\" --agent", RegistryValueKind.String);
                    else run.DeleteValue(App.RunValue, false);
                }
                Process.Start(new ProcessStartInfo(App.ExePath, "--agent") { UseShellExecute = true, WindowStyle = ProcessWindowStyle.Hidden });
                bool ready = false;
                for (int attempt = 0; attempt < 30; attempt++)
                {
                    await Task.Delay(200);
                    try
                    {
                        using (var client = ServerApi.Client())
                        {
                            client.Timeout = TimeSpan.FromSeconds(1);
                            client.DefaultRequestHeaders.Add("Origin", origin);
                            var body = await client.GetStringAsync("http://127.0.0.1:45873/health");
                            var health = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(body);
                            ready = health.ContainsKey("device_id") && (string)health["device_id"] == settings.DeviceId && health.ContainsKey("server_url") && (string)health["server_url"] == origin;
                        }
                    }
                    catch { }
                    if (ready) break;
                }
                if (!ready) throw new InvalidOperationException("Agent가 시작되지 않았습니다. 기존 Agent 실행 여부와 native-agent.log를 확인해 주세요.");
                status.ForeColor = Color.FromArgb(19, 105, 72);
                status.Text = "설치 완료. ERP의 ‘내 근태 → 다시 확인’을 눌러 주세요.\n이 창을 닫아도 Agent는 실행됩니다.";
                token.Clear(); install.Text = "다시 설정"; open.Visible = true;
                App.Log("Installation completed. Credentials stored with Windows user encryption.");
            }
            catch (HttpRequestException) { status.ForeColor = Color.Firebrick; status.Text = "ERP HTTPS 연결에 실패했습니다. 서버 주소·3443 포트·서버 인증서를 확인해 주세요."; }
            catch (TaskCanceledException) { status.ForeColor = Color.Firebrick; status.Text = "ERP 서버 응답 시간이 초과되었습니다. 서버 연결을 확인한 뒤 다시 시도해 주세요."; }
            catch (Exception error) { status.ForeColor = Color.Firebrick; status.Text = error.Message; }
            finally { working = false; install.Enabled = true; }
        }
    }

    internal static class Program
    {
#if !TEST
        [STAThread]
        private static int Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            CertificateTrust.Configure();
            if (args.Length == 2 && args[0] == "--render-preview")
            {
                using (var form = new SetupForm(false))
                {
                    form.ShowInTaskbar = false; form.Opacity = 0; form.Show(); Application.DoEvents();
                    using (var bitmap = new Bitmap(form.Width, form.Height))
                    {
                        form.DrawToBitmap(bitmap, new Rectangle(0, 0, bitmap.Width, bitmap.Height));
                        bitmap.Save(args[1], System.Drawing.Imaging.ImageFormat.Png);
                    }
                    form.Close();
                }
                return 0;
            }
            if (args.Length == 1 && args[0] == "--agent")
            {
                try { using (var context = new AgentContext()) Application.Run(context); return 0; }
                catch (Exception error) { App.Log("Agent startup failed: " + error.GetType().Name); return 1; }
            }
            Application.Run(new SetupForm(true));
            return 0;
        }
#endif
    }
}
