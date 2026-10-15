import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { ProblemDetailsFilter } from './common/problem-details.filter';

export function buildOpenApi(app: INestApplication): OpenAPIObject {
  const cfg = new DocumentBuilder()
    .setTitle('AdFlow Campaign API')
    .setDescription('AdFlow is a fictional ad platform used for demonstration only.')
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .build();
  return SwaggerModule.createDocument(app, cfg);
}

/** Shared by main.ts and the e2e tests so tests exercise the real pipeline. */
export function configureApp(app: INestApplication): void {
  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new ProblemDetailsFilter());
  SwaggerModule.setup('docs', app, buildOpenApi(app));
}
