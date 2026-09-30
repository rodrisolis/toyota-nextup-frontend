import {
  IPublicClientApplication,
  PublicClientApplication,
  BrowserCacheLocation,
  InteractionType
} from "@azure/msal-browser";

import {
  MsalGuardConfiguration,
  MsalInterceptorConfiguration
} from "@azure/msal-angular";

import { environment } from "../../../environments/environment";


export function MSALInstanceFactory(): IPublicClientApplication {
  return new PublicClientApplication({
    auth: {
      clientId: environment.mslConfig.clientId,
      authority: environment.mslConfig.authority,
      redirectUri: environment.mslConfig.redirectUri,
    },
    cache: {
      cacheLocation: BrowserCacheLocation.LocalStorage,
    },
  });
}

export function MSALGuardConfigFactory(): MsalGuardConfiguration {
  return {
    interactionType: InteractionType.Redirect,
    authRequest: {
      scopes: ["User.Read"],
    },
  };
}

export function MSALInterceptorConfigFactory(): MsalInterceptorConfiguration {
  const protectedResourceMap = new Map<string, Array<string>>();

  protectedResourceMap.set(
    "https://graph.microsoft.com/v1.0/me",
    ["User.Read"]
  );

  return {
    interactionType: InteractionType.Redirect,
    protectedResourceMap,
  };
}