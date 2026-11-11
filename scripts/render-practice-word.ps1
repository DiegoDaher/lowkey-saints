$ErrorActionPreference = 'Stop'
$practiceRoot = Split-Path $PSScriptRoot -Parent
$practiceDoc = Join-Path $practiceRoot 'docs/entregables/Lowkey_Saints_Seguridad_APIs_Despliegue.docx'
$practiceQa = Join-Path $practiceRoot 'out/practice-docx-qa'
New-Item -ItemType Directory -Force -Path $practiceQa | Out-Null
$practicePdf = Join-Path $practiceQa 'report.pdf'
$practiceOwnWord = $false
try { $practiceWord = [Runtime.InteropServices.Marshal]::GetActiveObject('Word.Application') }
catch { $practiceWord = New-Object -ComObject Word.Application; $practiceOwnWord = $true }
$practiceGet = [Reflection.BindingFlags]::GetProperty
$practiceInvoke = [Reflection.BindingFlags]::InvokeMethod
try {
    $practiceDocs = $practiceWord.GetType().InvokeMember('Documents', $practiceGet, $null, $practiceWord, $null)
    $practiceOpenDoc = $practiceDocs.GetType().InvokeMember('Open', $practiceInvoke, $null, $practiceDocs, @([string]$practiceDoc))
    $practiceOpenDoc.GetType().InvokeMember('ExportAsFixedFormat', $practiceInvoke, $null, $practiceOpenDoc, @([string]$practicePdf, [int]17))
    $practiceOpenDoc.GetType().InvokeMember('Close', $practiceInvoke, $null, $practiceOpenDoc, @(0))
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($practiceOpenDoc)
} finally {
    if ($practiceOwnWord) { $practiceWord.GetType().InvokeMember('Quit', $practiceInvoke, $null, $practiceWord, @(0)) }
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($practiceWord)
}
$practicePoppler = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin/pdftoppm.exe'
& $practicePoppler -scale-to 1400 -png $practicePdf (Join-Path $practiceQa 'page')
if ($LASTEXITCODE -ne 0) { throw 'PDF rendering failed' }
Get-ChildItem $practiceQa -Filter 'page-*.png' | Select-Object Name,Length
