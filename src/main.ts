import './style.css';
import { FootballApplication } from './app/FootballApplication';
import { GAME_BRAND } from './config/GameBrand';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Missing #app mount point');
}

const footballApplication = new FootballApplication({ mount: app });
document.title = GAME_BRAND.title;
footballApplication.start();
