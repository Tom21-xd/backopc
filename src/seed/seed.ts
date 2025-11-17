import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SeedService } from './seed.service';

async function runSeed() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const seedService = app.get(SeedService);
    await seedService.seed();
    console.log('✅ Seed de datos completado exitosamente');
  } catch (error) {
    console.error('❌ Error al ejecutar el seed:', error);
    throw error;
  } finally {
    await app.close();
  }
}

runSeed();