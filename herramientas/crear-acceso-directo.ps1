# Crea el acceso directo "Fabrica de Hielo" en el escritorio.
# Lo llama CREAR-ACCESO-DIRECTO.bat; no hace falta ejecutarlo a mano.

$carpeta = Split-Path -Parent $PSScriptRoot      # carpeta del proyecto
$destino = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Fabrica de Hielo.lnk'

try {
    $shell = New-Object -ComObject WScript.Shell
    $acceso = $shell.CreateShortcut($destino)
    $acceso.TargetPath       = Join-Path $carpeta 'INICIAR.bat'
    $acceso.WorkingDirectory = $carpeta
    $acceso.IconLocation     = Join-Path $carpeta 'icono.ico'
    $acceso.Description      = 'Sistema de gestion de la fabrica de hielo'
    $acceso.Save()

    Write-Host ''
    Write-Host '   Listo. Ya tienes el icono "Fabrica de Hielo" en el escritorio.'
    Write-Host '   Desde ahora solo das doble clic ahi.'
    Write-Host ''
    exit 0
}
catch {
    Write-Host ''
    Write-Host '   No se pudo crear el acceso directo:'
    Write-Host ("   " + $_.Exception.Message)
    Write-Host ''
    Write-Host '   Alternativa a mano: clic derecho sobre INICIAR.bat,'
    Write-Host '   Enviar a > Escritorio (crear acceso directo).'
    Write-Host ''
    exit 1
}
