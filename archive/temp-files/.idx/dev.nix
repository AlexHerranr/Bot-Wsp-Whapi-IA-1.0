{ pkgs, ... }: {
  # Which nixpkgs channel to use.
  channel = "unstable"; # or "unstable"
  # Use https://search.nixos.org/packages to find packages
  packages = [
    # pkgs.go
    # pkgs.python311Packages.pip
    pkgs.nodejs_20
    pkgs.nodePackages.nodemon
    pkgs.ngrok
  ];
  # Sets environment variables in the workspace
  env = {};
  # Fast way to run services in the workspace.
  # More info: https://devenv.sh/services/
  services.postgres.enable = true;
  # Useful for devcontainers.
  # More info: https://devenv.sh/integrations/vscode/
  # vscode.enable = true;
  # Enable pre-commit hooks
  # More info: https://devenv.sh/pre-commit-hooks/
  # pre-commit.hooks = {
  #   alejandra.enable = true;
  #   deadnix.enable = true;
  # };
}
