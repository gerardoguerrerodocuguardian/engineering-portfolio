import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';

const serverConfig_: ApplicationConfig = {
  providers: [provideServerRendering(withRoutes(serverRoutes))],
};

export const serverConfig = mergeApplicationConfig(appConfig, serverConfig_);
