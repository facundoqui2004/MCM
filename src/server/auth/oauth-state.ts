import "server-only";

/** Estado del inicio de sesión mientras el usuario está en la pantalla de Google */
export interface OAuthState {
  state: string;
  returnTo: string;
  popup: boolean;
  consent: boolean;
}
export const OAUTH_COOKIE = "mm_oauth";
