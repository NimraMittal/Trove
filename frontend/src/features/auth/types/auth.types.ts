export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type SignupInput = {
  displayName: string;
  email: string;
  password: string;
};