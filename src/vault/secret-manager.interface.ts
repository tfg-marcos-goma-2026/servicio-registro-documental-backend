export abstract class SecretManager {
  abstract getPrivateKey(): Promise<string>;
}
