// Mounts every Continue reading link on the page. Imported by both
// SiteHeader (the phone menu's link) and ContinueReading.astro; as an ES
// module it runs once however many components import it.
import { mountContinueReading } from "./last-read.js";

mountContinueReading();
