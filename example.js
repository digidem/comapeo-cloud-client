import { MapeoCloud } from "./index.js";

const config = await MapeoCloud.getConfig("./.env")
const mapeoCloud = new MapeoCloud(config)
await mapeoCloud.start()
