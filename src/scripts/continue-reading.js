// Mounts every Continue reading link on the page. Imported by
// ContinueReading.astro (Home and /read); as an ES module it runs once
// however many of them a page holds.
import { mountContinueReading } from "./last-read.js";

mountContinueReading();
