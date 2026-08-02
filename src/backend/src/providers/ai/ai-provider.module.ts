import { Module } from '@nestjs/common';
import { NvidiaProvider } from './nvidia.provider';
import { LocalProvider } from './local.provider';
import { AIProviderRouter } from './provider.router';

@Module({
  providers: [
    NvidiaProvider,
    LocalProvider,
    AIProviderRouter,
  ],
  exports: [AIProviderRouter],
})
export class AIProviderModule {
  // This method will be called after the module is initialized to set up the router
  constructor(
    private nvidiaProvider: NvidiaProvider,
    private localProvider: LocalProvider,
    private router: AIProviderRouter
  ) {
    // Set the providers in the router
    this.router.setProviders([this.nvidiaProvider, this.localProvider]);
  }
}