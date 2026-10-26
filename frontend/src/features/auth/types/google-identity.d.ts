export {};

type GoogleCredentialResponse = {
  credential?: string;
  select_by?: string;
  state?: string;
};

type GoogleIdConfiguration = {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  auto_select?: boolean;
  button_auto_select?: boolean;
  use_fedcm_for_button?: boolean;
  ux_mode?: "popup" | "redirect";
};

type GoogleButtonConfiguration = {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  logo_alignment?: "left" | "center";
  width?: string;
};

type GoogleIdentityServices = {
  initialize(configuration: GoogleIdConfiguration): void;
  renderButton(
    parent: HTMLElement,
    configuration: GoogleButtonConfiguration,
  ): void;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: GoogleIdentityServices;
      };
    };
  }
}
