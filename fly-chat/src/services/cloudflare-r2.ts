/**
 * Cloudflare R2 wrapper using the S3-compatible API.
 * Provides get/put/delete matching the R2Bucket binding interface.
 */

import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

export class CloudflareR2 {
  private client: S3Client;
  private bucket: string;

  constructor(accountId: string, accessKeyId: string, secretAccessKey: string, bucketName: string) {
    this.bucket = bucketName;
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async get(key: string): Promise<R2Object | null> {
    try {
      const res = await this.client.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));

      if (!res.Body) return null;

      const bodyText = await res.Body.transformToString("utf-8");

      return {
        text: async () => bodyText,
        json: async () => JSON.parse(bodyText),
      };
    } catch (err: any) {
      if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw err;
    }
  }

  async put(key: string, value: string | Buffer): Promise<void> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: typeof value === "string" ? value : value,
      ContentType: "application/json",
    }));
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }));
  }
}

export interface R2Object {
  text: () => Promise<string>;
  json: () => Promise<any>;
}
