[Setup]
AppName=Mongo-ose
AppVersion={#AppVersion}
AppPublisher=Paul Allington
AppPublisherURL=https://github.com/paulallington/Mongo-ose
DefaultDirName={autopf}\Mongo-ose
DefaultGroupName=Mongo-ose
UninstallDisplayIcon={app}\mongo-ose.exe
OutputDir=..\release
OutputBaseFilename=mongo-ose-setup
SetupIconFile=..\client\public\favicon.ico
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=lowest
WizardStyle=modern

[Files]
Source: "..\release\mongo-ose.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\Mongo-ose"; Filename: "{app}\mongo-ose.exe"; IconFilename: "{app}\mongo-ose.exe"
Name: "{autodesktop}\Mongo-ose"; Filename: "{app}\mongo-ose.exe"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional shortcuts:"

[Run]
Filename: "{app}\mongo-ose.exe"; Description: "Launch Mongo-ose"; Flags: nowait postinstall skipifsilent
