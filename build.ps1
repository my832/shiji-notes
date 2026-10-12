param([string]$JavaHome = 'C:/Program Files/Android/Android Studio/jbr', [string]$Sdk = "$PSScriptRoot/sdk", [string]$Destination = "$PSScriptRoot/releases/shiji-1.3.1.apk")
$ErrorActionPreference = 'Stop'
$taskBuild = "$PSScriptRoot/build"
$taskApp = "$PSScriptRoot/app"
$taskTools = "$Sdk/android-15"
if (!(Test-Path -LiteralPath "$taskTools/aapt2.exe")) { $taskTools = (Get-ChildItem -LiteralPath $Sdk -Directory | Where-Object { Test-Path -LiteralPath "$($_.FullName)/aapt2.exe" } | Select-Object -First 1).FullName }
$taskPlatform = (Get-ChildItem -LiteralPath $Sdk -Directory | Where-Object { Test-Path -LiteralPath "$($_.FullName)/android.jar" } | Select-Object -First 1).FullName
if (!$taskTools -and (Test-Path -LiteralPath "$Sdk/build-tools")) { $taskTools=(Get-ChildItem -LiteralPath "$Sdk/build-tools" -Directory | Sort-Object Name -Descending | Where-Object { Test-Path -LiteralPath "$($_.FullName)/aapt2.exe" } | Select-Object -First 1).FullName }
if (!$taskPlatform -and (Test-Path -LiteralPath "$Sdk/platforms/android-35/android.jar")) { $taskPlatform="$Sdk/platforms/android-35" }
if (!$taskTools -or !$taskPlatform) { throw 'Android SDK platform or build tools missing' }
$env:JAVA_HOME = $JavaHome
$env:PATH = "$JavaHome/bin;$env:PATH"
New-Item -ItemType Directory -Force -Path "$taskBuild/classes","$taskBuild/dex" | Out-Null
function Check-Exit { if ($LASTEXITCODE -ne 0) { throw "Build command failed: $LASTEXITCODE" } }
& "$taskTools/aapt2.exe" compile --dir "$taskApp/res" -o "$taskBuild/resources.zip"
Check-Exit
& "$taskTools/aapt2.exe" link -o "$taskBuild/base.apk" -I "$taskPlatform/android.jar" --manifest "$taskApp/AndroidManifest.xml" -A "$taskApp/assets" -R "$taskBuild/resources.zip" --auto-add-overlay
Check-Exit
$taskJavaFiles = (Get-ChildItem -LiteralPath "$taskApp/src/com/shiji/notes" -Filter '*.java').FullName
& "$JavaHome/bin/javac.exe" -encoding UTF-8 --release 8 -classpath "$taskPlatform/android.jar" -d "$taskBuild/classes" $taskJavaFiles
Check-Exit
& "$JavaHome/bin/jar.exe" cf "$taskBuild/classes.jar" -C "$taskBuild/classes" .
Check-Exit
& "$JavaHome/bin/java.exe" -cp "$taskTools/lib/d8.jar" com.android.tools.r8.D8 --release --min-api 26 --lib "$taskPlatform/android.jar" --output "$taskBuild/dex" "$taskBuild/classes.jar"
Check-Exit
& "$JavaHome/bin/jar.exe" uf "$taskBuild/base.apk" -C "$taskBuild/dex" classes.dex
Check-Exit
& "$taskTools/zipalign.exe" -p -f 4 "$taskBuild/base.apk" "$taskBuild/aligned.apk"
Check-Exit
$taskKey = "$PSScriptRoot/local-signing.jks"
if (!$env:SHIJI_KEYSTORE_PASSWORD) { throw "Set SHIJI_KEYSTORE_PASSWORD before building. Keep this password and the local keystore private." }
if (!(Test-Path -LiteralPath $taskKey)) {
 & "$JavaHome/bin/keytool.exe" -genkeypair -keystore $taskKey -alias shiji -storepass:env SHIJI_KEYSTORE_PASSWORD -keypass:env SHIJI_KEYSTORE_PASSWORD -dname 'CN=Shiji Local, OU=Personal, O=Shiji, C=CN' -keyalg RSA -keysize 3072 -validity 10000
 Check-Exit
}
& "$JavaHome/bin/java.exe" -jar "$taskTools/lib/apksigner.jar" sign --v4-signing-enabled false --ks $taskKey --ks-key-alias shiji --ks-pass env:SHIJI_KEYSTORE_PASSWORD --key-pass env:SHIJI_KEYSTORE_PASSWORD --out $Destination "$taskBuild/aligned.apk"
Check-Exit
& "$JavaHome/bin/java.exe" -jar "$taskTools/lib/apksigner.jar" verify --verbose $Destination
Check-Exit
& "$taskTools/aapt.exe" dump badging $Destination
Check-Exit
Get-FileHash -LiteralPath $Destination -Algorithm SHA256
