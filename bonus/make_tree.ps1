# === Переместить файлы в корень проекта! ===
$Root = Get-Location
$OutFile = Join-Path $Root "structure.txt"

function Show-Tree {
    param(
        [string]$Path,
        [string]$Prefix = ""
    )

    # Получаем список элементов
    $items = Get-ChildItem -LiteralPath $Path | Where-Object {
        $_.Name -notin @("make_tree.bat","make_tree.ps1")
    } | Sort-Object Name

    $count = $items.Count
    for ($i = 0; $i -lt $count; $i++) {
        $item = $items[$i]
        $isLast = ($i -eq $count - 1)

        if ($isLast) {
            $branch = "└─ "
        } else {
            $branch = "├─ "
        }

        $line = $Prefix + $branch + $item.Name
        $line | Out-File -FilePath $OutFile -Encoding utf8 -Append

        if ($item.PSIsContainer) {
            if ($isLast) {
                $newPrefix = $Prefix + "   "
            } else {
                $newPrefix = $Prefix + "│  "
            }
            Show-Tree -Path $item.FullName -Prefix $newPrefix
        }
    }
}

# Заголовок
"/project/" | Out-File -FilePath $OutFile -Encoding utf8
"│" | Out-File -FilePath $OutFile -Encoding utf8 -Append

# Пуск
Show-Tree -Path $Root
Write-Host "tree сохранено в $OutFile"
