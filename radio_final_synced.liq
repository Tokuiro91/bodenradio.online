settings.init.allow_root.set(true)
settings.log.level.set(3)
settings.server.telnet.set(true)
settings.server.telnet.port.set(1234)
settings.server.telnet.bind_addr.set("127.0.0.1")

music_dir = 'data/radio/music'

def get_next_track() =
  # Fetch from Node.js bridge
  # The bridge now returns "annotate:liq_start_next=X:/path/to/file.mp3"
  result = process.read.lines(timeout=2.0, "curl -s http://127.0.0.1:8080/internal/next")
  if list.length(result) > 0 then
    res = list.hd(default="", result)
    if res != "" and res != "NO_SCHEDULE" and res != "TRACK_NOT_FOUND" and res != "PLAYLIST_EMPTY" then
      request.create(res)
    else
      request.create("")
    end
  else
    request.create("")
  end
end

# Primary source: Dashboard schedule
my_source = request.dynamic(id="boden_dashboard", prefetch=0, get_next_track)

# Wrap with cue_cut to respect metadata boundaries (liq_cue_in/out)
my_source = cue_cut(my_source)

# Fallback: Random music from the directory
# We use track_sensitive=false for the fallback to interrupt it when a scheduled item is ready
fallback_music = playlist(music_dir, mode='randomize', reload_mode='watch')

# Final output source with smooth crossfading
radio = fallback(track_sensitive=false, [my_source, fallback_music, blank()])

# Apply crossfading for smooth transitions and fade-outs
radio = crossfade(smart=true, duration=5.0, fade_out=5.0, fade_in=0.0, radio)

# Make sure it never stops
radio = mksafe(radio)

output.icecast(%mp3(bitrate=192), 
  host='127.0.0.1', port=9090, 
  password='AgileRadio2026!', mount='stream.mp3', 
  name="BØDEN RADIO",
  description="BØDEN Online Live",
  radio)
