#!/usr/bin/liquidsoap

# Settings
settings.init.allow_root.set(true)
settings.log.level.set(3)
settings.server.telnet.set(true)
settings.server.telnet.port.set(1234)
settings.server.telnet.bind_addr.set("127.0.0.1")

# The path to our schedule bridge
bridge_path = "/usr/bin/node /radio/scripts/liq-bridge.js"
bitrate_path = "/usr/bin/node -e \"console.log(JSON.parse(require('fs').readFileSync('/radio/data/radio_config.json')).bitrate)\""

def get_bitrate() =
  result = process.read.lines(bitrate_path)
  if list.length(result) > 0 then
    int_of_string(default=192, list.hd(default="192", result))
  else
    192
  end
end

current_bitrate = get_bitrate()

def get_scheduled_track() =
  # Call bridge to get the current track based on schedule.csv
  result = process.read.lines(bridge_path)
  if list.length(result) > 0 then
    res = list.hd(default="", result)
    if res != "" and res != "SILENCE" then
      request.create(res)
    else
      request.create("")
    end
  else
    request.create("")
  end
end

# Primary source: Polling the bridge every second (roughly) via request.dynamic
# We use prefetch=0 to ensure we get the latest schedule info exactly when needed
radio_source = request.dynamic(id="radio_scheduler", prefetch=0, get_scheduled_track)

# Fallback to silence if nothing is scheduled
radio = fallback(track_sensitive=false, [radio_source, blank()])

# Output to Icecast
output.icecast(%mp3(bitrate=current_bitrate),
  host='127.0.0.1', port=8000,
  password='hackme', mount='/radio',
  name="BØDEN RADIO",
  description="Precision Scheduled Radio",
  genre="Mixed",
  radio)
