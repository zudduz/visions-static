{ ... }: {
  channel = "stable-24.05";

  packages = [
  ];

  env = {};
  idx = {
    extensions = [
      "vscodevim.vim"
    ];

    # Enable previews
    previews = {
      enable = true;
      previews = {
      };
    };

    workspace = {
      onCreate = {
      };
      onStart = {
      };
    };
  };
}
