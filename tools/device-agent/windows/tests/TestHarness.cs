using System;
using System.IO;
using System.Security.Cryptography;
using System.Web.Script.Serialization;
using System.Reflection;
using System.Security.AccessControl;
using System.Windows.Forms;
using DigitalSquare.DeviceAgent;

internal static class TestHarness
{
    [STAThread]
    private static int Main(string[] args)
    {
        try
        {
            CertificateTrust.Configure();
            if (args.Length == 1 && args[0] == "--ui-check")
            {
                using (var form = new SetupForm(false))
                {
                    var flags = BindingFlags.NonPublic | BindingFlags.Instance;
                    var tokenInput = (TextBox)typeof(SetupForm).GetField("token", flags).GetValue(form);
                    var uuidInput = (TextBox)typeof(SetupForm).GetField("deviceId", flags).GetValue(form);
                    var status = (Label)typeof(SetupForm).GetField("status", flags).GetValue(form);
                    var install = typeof(SetupForm).GetMethod("Install", flags);
                    if (!tokenInput.UseSystemPasswordChar) throw new Exception("Token field is not masked.");
                    ((System.Threading.Tasks.Task)install.Invoke(form, null)).GetAwaiter().GetResult();
                    if (!status.Text.Contains("UUID")) throw new Exception("Missing UUID did not produce guidance.");
                    uuidInput.Text = Guid.NewGuid().ToString("D"); tokenInput.Text = "short";
                    ((System.Threading.Tasks.Task)install.Invoke(form, null)).GetAwaiter().GetResult();
                    if (!status.Text.Contains("토큰")) throw new Exception("Invalid token did not produce guidance.");
                }
                Console.WriteLine("GUI validation and masked token field: OK");
                return 0;
            }
            if (args.Length == 1 && args[0] == "--storage-check")
            {
                App.SecureDirectory();
                var storageSettings = new AgentSettings { ServerUrl = App.DefaultUrl, DeviceId = Guid.NewGuid().ToString("D"), ProtectedToken = AgentSettings.Protect("test-only-credential-with-more-than-thirty-two-characters"), AutoStart = false };
                storageSettings.Save(); storageSettings.AutoStart = true; storageSettings.Save();
                var roundtrip = AgentSettings.Load();
                if (!roundtrip.AutoStart || roundtrip.DeviceId != storageSettings.DeviceId || roundtrip.Token() != storageSettings.Token()) throw new Exception("Settings roundtrip failed.");
                if (File.ReadAllText(App.SettingsPath).Contains("test-only-credential")) throw new Exception("Plaintext credential stored.");
                var acl = Directory.GetAccessControl(App.DirectoryPath);
                if (!acl.AreAccessRulesProtected) throw new Exception("Credential folder inherits broad permissions.");
                if (acl.GetAccessRules(true, true, typeof(System.Security.Principal.SecurityIdentifier)).Count != 3) throw new Exception("Unexpected credential-folder permissions.");
                File.Delete(App.SettingsPath);
                Directory.Delete(App.DirectoryPath);
                Console.WriteLine("Encrypted settings, atomic update and restricted Windows folder permissions: OK");
                return 0;
            }
            if (args.Length == 2 && args[0] == "--health")
            {
                ServerApi.Health(App.Origin(args[1])).GetAwaiter().GetResult();
                Console.WriteLine("HTTPS health: OK");
                return 0;
            }
            var token = "test-only-credential-with-more-than-thirty-two-characters";
            var settings = new AgentSettings { ServerUrl = App.Origin(args[0]), DeviceId = "db863cf0-e2e0-4f0d-9300-515af3b58301", ProtectedToken = AgentSettings.Protect(token), AutoStart = false };
            if (settings.Token() != token) throw new Exception("DPAPI round trip failed.");
            if (settings.ProtectedToken.Contains(token) || new JavaScriptSerializer().Serialize(settings).Contains(token)) throw new Exception("Plaintext token persisted.");
            var bytes = Convert.FromBase64String(settings.ProtectedToken);
            bytes[bytes.Length - 5] ^= 1;
            bool tamperRejected = false;
            try { new AgentSettings { ProtectedToken = Convert.ToBase64String(bytes) }.Token(); }
            catch (CryptographicException) { tamperRejected = true; }
            if (!tamperRejected) throw new Exception("Tampered DPAPI data was accepted.");
            bool insecureRejected = false;
            try { App.Origin("http://192.168.1.109:3200"); } catch (InvalidOperationException) { insecureRejected = true; }
            if (!insecureRejected) throw new Exception("HTTP origin was accepted.");
            using (var server = new ProofServer(settings, 0))
            {
                server.Start();
                Console.WriteLine("READY " + server.Port);
                Console.Out.Flush();
                Console.ReadLine();
            }
            return 0;
        }
        catch (Exception error) { Console.Error.WriteLine(error.GetType().Name + ": " + error.Message); return 1; }
    }
}
