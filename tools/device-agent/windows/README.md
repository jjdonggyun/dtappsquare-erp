# Windows PC Agent

직원은 [설치 EXE 다운로드](https://github.com/jjdonggyun/dtappsquare-erp/raw/refs/heads/main/public/downloads/DigitalSquare.DeviceAgent.Setup.exe)에서 파일 하나를 받아 실행합니다. ERP의 **내 근태 → PC Agent 설치(EXE)**에서도 같은 파일을 받을 수 있습니다.

## 직원 설치

1. 실제 자산을 지급받은 Windows PC에서 EXE를 더블클릭합니다.
2. 기본 ERP 주소 `https://192.168.1.109:3443`을 확인합니다.
3. 장치관리 화면의 Hostname 아래에 있는 **Device UUID**와 장치 등록 직후 발급받은 **원본 토큰**을 입력합니다.
4. **설치하고 연결**을 누릅니다. 회사 인증서 등록 확인이 표시되면 인증서 정보를 확인합니다.
5. ERP에 해당 PC를 지급받은 직원 계정으로 로그인하고 **내 근태 → 다시 확인**을 누릅니다. 브라우저의 로컬·루프백 네트워크 접근 요청은 이 ERP에 대해 허용합니다.

Windows 10/11의 .NET Framework 4.8을 사용하며 Node.js와 PowerShell 설치 작업은 필요하지 않습니다. 설치 창을 닫아도 Agent는 알림 영역에서 실행됩니다. Windows 로그인 시 자동 실행을 선택하면 현재 Windows 사용자의 시작 프로그램에 등록됩니다. 현재 빌드는 코드서명이 없으므로 회사의 실행 파일 허용 정책을 확인해야 합니다.

서버에는 HTTPS와 해당 접속 주소의 `APP_URL`·`APP_ALLOWED_ORIGINS` 구성이 필요합니다. 회사 네트워크와 실제 지급 이력은 기존 서버 정책으로 검증합니다. 원본 토큰을 보관하지 않았다면 관리자의 토큰 재발급 처리가 먼저 필요합니다.

## 동작과 저장 위치

- 설치: `%LOCALAPPDATA%\DigitalSquare\DeviceAgent\DigitalSquare.DeviceAgent.exe`
- 설정: 같은 폴더의 `settings.json`; 토큰은 Windows DPAPI `CurrentUser`로 암호화합니다.
- 로그: `native-agent.log`; 토큰이나 요청 본문은 기록하지 않습니다.
- 수신: `127.0.0.1:45873`; 설정된 ERP Origin의 요청만 허용합니다.
- 증명: 기존 `/api/device-agent/attendance-proof`에 검증 ID, 장치 UUID·토큰, UTC timestamp와 임의 nonce를 전송합니다.
- 자동 실행: 현재 사용자의 `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`.

알림 영역 아이콘의 **설정 변경**으로 정보를 갱신하고 **종료**로 프로세스를 종료합니다. 자동 실행은 Windows 시작프로그램 설정에서 끌 수 있습니다. 이전 Node.js/PowerShell Agent가 이미 45873 포트에서 실행 중이면 먼저 종료합니다.

이 Agent는 등록 자격정보로 기기를 증명하며 하드웨어 무결성이나 물리적 재실을 보증하지 않습니다. Windows 사용자 권한을 탈취한 프로그램에 대한 방어는 별도 단말 보안 정책이 필요합니다.

## 빌드

Windows PowerShell에서 실행합니다.

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\tools\device-agent\windows\build.ps1
```

Windows에 포함된 .NET Framework C# 컴파일러를 사용합니다. 결과는 `public/downloads/DigitalSquare.DeviceAgent.Setup.exe`와 SHA-256 파일입니다. Next.js의 `public` 디렉터리 및 기존 Docker 배포가 그대로 제공하므로 배포 후 `/downloads/DigitalSquare.DeviceAgent.Setup.exe`에서 받을 수 있습니다.

`company-root-ca.cer`는 서버가 발급한 **공개 CA 인증서**입니다. 현재 EXE에 포함되며 개인키와 직원 토큰은 저장소나 EXE에 포함하지 않습니다. 서버 CA를 교체하면 해당 공개 인증서를 갱신하고 다시 빌드합니다. 다른 인증서는 `-CertificatePath`로 지정할 수 있습니다. 사설 인증서 연결은 포함된 CA로 검증하고, 인증서 이름과 유효기간 검사 및 공개 CA의 정상 HTTPS 검증도 유지합니다.

## 검증

개발 PC에 Node.js와 OpenSSL이 필요합니다. Git for Windows의 OpenSSL도 지원합니다.

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\tools\device-agent\windows\tests\run.ps1
```

테스트 인증서와 실행 파일은 Git에서 제외되는 `output/device-agent-tests`에 생성합니다. 회사 CA를 신뢰 저장소에 추가하거나 시작프로그램을 등록하지 않습니다.

입력 안내·토큰 마스킹, DPAPI 암호화·변조 거절, 설정 저장·폴더 권한, HTTPS·인증서 이름 검증, CORS, 요청 크기, nonce/timestamp, 거절 응답과 리디렉션 차단을 검증합니다. 실제 회사 인증서 등록·시작프로그램 적용·직원 출근 기록은 설치한 직원 PC에서 최종 확인합니다.
