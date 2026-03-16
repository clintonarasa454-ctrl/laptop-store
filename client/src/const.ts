export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const getLoginUrl = (redirect?: string, mode?: "register") => {
  const params = new URLSearchParams();
  if (redirect && redirect !== "/auth") {
    params.set("redirect", redirect);
  }
  if (mode === "register") {
    params.set("mode", "register");
  }
  const qs = params.toString();
  return qs ? `/auth?${qs}` : "/auth";
};
