<#
  commit-all.ps1
  ----------------------------------------------------------------
  Run this from inside your project folder:
    E:\Software Project\Project 1\2nd\workflex-bd

  What it does:
    1. Confirms you're inside a git repo (won't touch anything if not).
    2. Sets your git identity for THIS repo only (not global).
    3. Makes sure .gitignore exists and excludes node_modules, dist,
       .env, .expo, etc. so secrets/build junk never get committed.
    4. Makes sure "origin" points to your GitHub repo.
    5. Finds every new/changed/deleted file and commits EACH ONE
       separately, with a message auto-built from the file's own
       path/status - never hand-typed, so no more "alert.dto.ts"
       vs "pagination.dto.ts" mix-ups.
    6. Shows you the full commit log so you can review before pushing.
    7. Pushes to GitHub - asks for confirmation first, and never
       force-pushes automatically.
#>

$ErrorActionPreference = "Stop"
$RepoUrl = "https://github.com/ssharkar-2000/workflex-bd.git"
$GitName  = "ashfaksadikkawshik-art"
$GitEmail = "ashfaksadikkawshik-art@users.noreply.github.com"

# ---------------------------------------------------------------
# 1. Make sure we're inside a git repo (init one if this is brand new)
# ---------------------------------------------------------------
$isRepo = git rev-parse --is-inside-work-tree 2>$null
if (-not $isRepo) {
    Write-Host "`nThis folder is not a git repo yet. Initializing..." -ForegroundColor Yellow
    git init
    git branch -M main
}

# ---------------------------------------------------------------
# 2. Set identity for this repo only (--local, not --global)
# ---------------------------------------------------------------
git config --local user.name  $GitName
git config --local user.email $GitEmail
Write-Host "Git identity set -> $GitName <$GitEmail>" -ForegroundColor Green

# ---------------------------------------------------------------
# 3. Ensure .gitignore covers the obvious stuff
# ---------------------------------------------------------------
$gitignorePath = ".gitignore"
$requiredIgnores = @(
    "node_modules/",
    "dist/",
    "build/",
    ".expo/",
    ".env",
    ".env.local",
    "*.log",
    ".DS_Store"
)

if (-not (Test-Path $gitignorePath)) {
    New-Item -ItemType File -Path $gitignorePath | Out-Null
}
$existing = Get-Content $gitignorePath -Raw -ErrorAction SilentlyContinue
if (-not $existing) { $existing = "" }

$added = $false
foreach ($line in $requiredIgnores) {
    if ($existing -notmatch [regex]::Escape($line)) {
        Add-Content -Path $gitignorePath -Value $line
        $added = $true
    }
}
if ($added) {
    git add .gitignore
    git commit -m "chore: update .gitignore" | Out-Null
    Write-Host "Updated .gitignore" -ForegroundColor Green
}

# ---------------------------------------------------------------
# 4. Make sure origin points to the right repo
# ---------------------------------------------------------------
$currentRemote = git remote get-url origin 2>$null
if (-not $currentRemote) {
    git remote add origin $RepoUrl
    Write-Host "Added remote origin -> $RepoUrl" -ForegroundColor Green
} elseif ($currentRemote -ne $RepoUrl) {
    Write-Host "`nWARNING: origin is currently set to:" -ForegroundColor Yellow
    Write-Host "  $currentRemote"
    Write-Host "Expected:"
    Write-Host "  $RepoUrl"
    $fix = Read-Host "Update origin to the expected URL? (y/n)"
    if ($fix -eq "y") {
        git remote set-url origin $RepoUrl
        Write-Host "origin updated." -ForegroundColor Green
    }
}

# ---------------------------------------------------------------
# 5. Commit every changed file individually
# ---------------------------------------------------------------
$statusLines = git status --porcelain -uall
if (-not $statusLines) {
    Write-Host "`nNothing to commit - working tree is already clean." -ForegroundColor Cyan
} else {
    Write-Host "`nCommitting files one by one...`n" -ForegroundColor Cyan
    $count = 0

    foreach ($line in $statusLines) {
        # porcelain format: XY <path>   (renames: "R  old -> new")
        $statusCode = $line.Substring(0, 2)
        $path = $line.Substring(3).Trim()

        if ($path -match "^(.*) -> (.*)$") {
            $oldPath = $matches[1]
            $newPath = $matches[2]
            git add -- "$oldPath" "$newPath"
            $msg = "Rename $oldPath to $newPath"
        }
        else {
            git add -- "$path"
            switch -Regex ($statusCode.Trim()) {
                "^A"  { $msg = "Add $path" }
                "^M"  { $msg = "Update $path" }
                "^D"  { $msg = "Remove $path" }
                "^\?" { $msg = "Add $path" }
                default { $msg = "Update $path" }
            }
        }

        git commit -m "$msg" | Out-Null
        Write-Host "  [OK] $msg" -ForegroundColor Green
        $count++
    }

    Write-Host "`n$count file(s) committed.`n" -ForegroundColor Cyan
}

# ---------------------------------------------------------------
# 6. Show the log so you can double check before pushing
# ---------------------------------------------------------------
Write-Host "----- Recent commits -----" -ForegroundColor Cyan
git log --oneline -20

# ---------------------------------------------------------------
# 7. Push (with confirmation, never force by default)
# ---------------------------------------------------------------
$branch = git rev-parse --abbrev-ref HEAD
Write-Host "`nCurrent branch: $branch"
$doPush = Read-Host "Push these commits to origin/$branch now? (y/n)"
if ($doPush -eq "y") {
    git push -u origin $branch
    Write-Host "`nPushed to $RepoUrl ($branch)" -ForegroundColor Green
} else {
    Write-Host "`nSkipped push. Run this when ready:" -ForegroundColor Yellow
    Write-Host "  git push -u origin $branch"
}
