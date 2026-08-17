// Secrets Store secret 绑定类型（异步对象，通过 get() 读取明文）
interface SecretsStoreSecret {
  /**
   * 读取 secret 明文，不存在则抛出异常
   */
  get(): Promise<string>;
}