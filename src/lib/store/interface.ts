import type { Provider, RegisterProviderRequest } from "@/lib/types";

export interface IProviderStore {
  getAll(modelFilter?: string): Provider[] | Promise<Provider[]>;
  getById(id: string): Provider | undefined | Promise<Provider | undefined>;
  add(req: RegisterProviderRequest, models?: string[]): Provider | Promise<Provider>;
  remove(id: string): boolean | Promise<boolean>;
}
