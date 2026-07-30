import { defineBackground } from 'wxt/utils/define-background';
import '../src/background';

export default defineBackground(() => {
  // All listeners and logic reside in src/background.ts (side-effect import above)
});
