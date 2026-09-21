# Submitting to winget

`node scripts/winget-manifest.js` writes the manifests for a published release
into `packaging/winget/<version>/`. It reads the installer's checksum from the
release's own `SHA256SUMS.txt`, so the hash always matches the file people will
download.

Nothing here submits anything. Getting into winget means opening a pull request
against [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs), and
that pull request should come from a person.

## What the submission looks like

1. Fork `microsoft/winget-pkgs`.
2. Copy the three files to `manifests/m/meSingh/SukhiPlay/<version>/`. The path
   has to match `PackageIdentifier` and `PackageVersion` exactly.
3. Check them locally, on a Windows machine:

   ```powershell
   winget validate manifests\m\meSingh\SukhiPlay\<version>
   .\Tools\SandboxTest.ps1 manifests\m\meSingh\SukhiPlay\<version>
   ```

4. Open the pull request. Seven automated checks run in about half an hour,
   then a community moderator reviews it by hand. A first submission usually
   takes one to two weeks; later version bumps are much quicker.

`wingetcreate update meSingh.SukhiPlay` can do steps 1 to 4 for later releases,
if you would rather not copy files about.

## Two things that decide whether it passes

**The installer must install silently.** It does: the NSIS installer supports
`/S`, which is what `InstallerType: nullsoft` tells winget.

**Unsigned is allowed, but antivirus is the real gate.** Every submission is
scanned by a wall of antivirus engines, and an unsigned Electron installer can
trip a heuristic. If that happens the pull request is refused with
`Binary-Validation-Error`, and the way out is to report the false positive to
the vendor. Microsoft's own form is at
<https://www.microsoft.com/wdsi/filesubmission>.

## Why the URL is pinned to a tag

The manifest ties one version to one URL to one checksum. A `latest/download`
URL points at a different file after every release, so the checksum stops
matching and the package quietly becomes uninstallable. The generated manifests
use `releases/download/v<version>/...`, which never changes once published.
