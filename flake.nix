{
  description = "Dev shell for testease-agent";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };

        # Shared libraries Chromium/WebKit typically need under NixOS.
        playwrightRuntimeLibs = with pkgs; [
          glib
          nss
          nspr
          dbus
          atk
          at-spi2-atk
          cups
          libdrm
          expat
          xorg.libxcb
          xorg.libX11
          xorg.libXcomposite
          xorg.libXdamage
          xorg.libXext
          xorg.libXfixes
          xorg.libXrandr
          xorg.libxkbfile
          xorg.libXrender
          xorg.libXtst
          xorg.libXScrnSaver
          gtk3
          pango
          cairo
          alsa-lib
          mesa
          libgbm
          udev
          libxshmfence
          libGL
          stdenv.cc.cc.lib
        ];
      in {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_22
            pnpm
            git
            jq
            playwright-driver
            playwright-test
          ];

          LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath playwrightRuntimeLibs;

          # Make Playwright use Nix-provided browser bundle instead of downloading.
          PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";
          PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
          PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "true";

          shellHook = ''
            echo "Entered testease-agent dev shell"
            echo "Node: $(node --version) | pnpm: $(pnpm --version)"
            echo "Playwright browsers path: $PLAYWRIGHT_BROWSERS_PATH"
            echo "Run: pnpm install && pnpm test"
          '';
        };
      });
}
