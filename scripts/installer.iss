[Setup]
AppName=Mongo-ose
AppVersion={#AppVersion}
AppPublisher=Paul Allington
AppPublisherURL=https://github.com/paulallington/Mongo-ose
DefaultDirName={autopf}\Mongo-ose
DefaultGroupName=Mongo-ose
UninstallDisplayIcon={app}\favicon.ico
OutputDir=..\release
OutputBaseFilename=mongo-ose-setup
SetupIconFile=..\client\public\favicon.ico
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=lowest
WizardStyle=modern

[Files]
Source: "..\release\mongo-ose.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\client\public\favicon.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\Mongo-ose"; Filename: "{app}\mongo-ose.exe"; IconFilename: "{app}\favicon.ico"
Name: "{autodesktop}\Mongo-ose"; Filename: "{app}\mongo-ose.exe"; IconFilename: "{app}\favicon.ico"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional shortcuts:"

[Run]
Filename: "{app}\mongo-ose.exe"; Description: "Launch Mongo-ose"; Flags: nowait postinstall skipifsilent
