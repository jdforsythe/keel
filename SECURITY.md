# Security

Keel is pre-release and nothing in it is stable. If you find a vulnerability, report it privately through GitHub's private vulnerability reporting: open the repository's Security tab and choose Report a vulnerability. If you cannot use that, write to security@<domain to be set at launch>. Please do not open a public issue or pull request for it.

Describe what you found, the version or commit, and the steps to reproduce it. A report that names the spec section or threat it breaks is the easiest to act on.

What Keel guarantees, the adversaries it assumes and where its trust boundaries sit are in [docs/THREAT-MODEL.md](docs/THREAT-MODEL.md). Authentication is not one of them: Keel plugs into an auth library or platform and does not roll its own, so a flaw in the library or platform you plug in belongs to that project.
