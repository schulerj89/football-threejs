import './style.css';
import { FootballApplication } from './app/FootballApplication';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Missing #app mount point');
}

const footballApplication = new FootballApplication({ mount: app });
footballApplication.start();
