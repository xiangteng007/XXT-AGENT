import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

export async function accessSecret(projectId: string, secretId: string): Promise<string> {
  const client = new SecretManagerServiceClient();
  const name = `projects/${projectId}/secrets/${secretId}/versions/latest`;
  const [resp] = await client.accessSecretVersion({ name });
  const data = resp.payload?.data;
  if (!data) return "";
  if (typeof data === "string") return data;
  return new TextDecoder("utf-8").decode(data as Uint8Array);
}
