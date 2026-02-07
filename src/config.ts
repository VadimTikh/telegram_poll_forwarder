import { getEnvSecrets, getConfig, type UserConfig, type EnvSecrets } from './config-manager';

export interface AppConfig {
  tg: {
    apiId: number;
    apiHash: string;
    sourceGroup: string;
    destinationChat: string;
  };
  twilio: {
    accountSid: string;
    authToken: string;
    fromNumber: string;
    callPhoneNumber: string;
  };
  callCooldownMs: number;
}

export function buildConfig(): AppConfig {
  const secrets: EnvSecrets = getEnvSecrets();
  const user: UserConfig = getConfig();

  return {
    tg: {
      apiId: secrets.tgApiId,
      apiHash: secrets.tgApiHash,
      sourceGroup: user.sourceGroup,
      destinationChat: user.destinationChat || 'me',
    },
    twilio: {
      accountSid: secrets.twilioAccountSid,
      authToken: secrets.twilioAuthToken,
      fromNumber: secrets.twilioPhoneNumber,
      callPhoneNumber: user.callPhoneNumber,
    },
    callCooldownMs: (user.callCooldownSeconds || 60) * 1000,
  };
}
