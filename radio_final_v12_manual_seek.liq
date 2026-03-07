settings.init.allow_root.set(true)
settings.log.level.set(3)

music_dir = '/var/radio/music'

def get_next_track() =
  result = process.read.lines(timeout=3.0, "curl -s http://127.0.0.1:8080/internal/next")
  if list.length(result) > 0 then
    res = list.hd(default="", result)
    if res != "" and res != "NO_SCHEDULE" and res != "TRACK_NOT_FOUND" and res != "PLAYLIST_EMPTY" then
      log("Found scheduled item: #{res}")
      request.create(res)
    else
      request.create("")
    end
  else
    request.create("")
  end
end

my_source = request.dynamic(id="boden_dashboard", prefetch=1, get_next_track)

# Manual seek handler
def apply_seek(m) =
  s = m["liq_start"]
  if s != "" then
    offset = float_of_string(default=0.0, s)
    if offset > 0.0 then
      log("Manual seek triggered to #{offset}s")
      ignore(my_source.seek(offset))
    end
  end
end

my_source.on_track(apply_seek)

fallback_music = playlist(music_dir, mode='randomize', reload_mode='watch')
radio = fallback(track_sensitive=false, [my_source, fallback_music, blank()])
radio = mksafe(radio)

output.icecast(%mp3(bitrate=128), 
  host='127.0.0.1', port=9090, 
  password='AgileRadio2026!', mount='stream.mp3', 
  name="BØDEN RADIO",
  description="BØDEN Online Live",
  radio)
