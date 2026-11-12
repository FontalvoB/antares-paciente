# frozen_string_literal: true

# Ejecuta el helper real sin acceder a Apple ni cargar los lanes de fastlane.
def platform(*)
end

module UI
  def self.message(*)
  end

  def self.user_error!(message)
    raise message
  end
end

def latest_testflight_build_number(**)
  raise "Apple unavailable" if @lookup_error

  @latest
end

load File.expand_path("../Fastfile", __dir__)

saved = ENV.to_h.slice("BUILD_NUMBER", "GITHUB_RUN_NUMBER")
begin
  cases = [
    ["local", 67, nil, nil, 68],
    ["upload aún invisible en Apple", 67, "99", nil, 99],
    ["Apple por delante del número de corrida", 120, "99", nil, 121],
    ["primera build", 0, "99", nil, 99],
    ["override explícito", 67, "99", "150", 150],
  ]
  cases.each do |name, latest, run, override, expected|
    @latest = latest
    ENV["GITHUB_RUN_NUMBER"] = run
    ENV["BUILD_NUMBER"] = override
    actual = next_build_number({})
    raise "#{name}: expected #{expected}, got #{actual}" unless actual == expected
  end

  ENV.delete("BUILD_NUMBER")
  @lookup_error = true
  begin
    next_build_number({})
    raise "La consulta fallida no debe producir otro número"
  rescue RuntimeError => e
    raise unless e.message.include?("no se reutilizará")
  end
  puts "6 build-number checks passed (no Apple access)"
ensure
  %w[BUILD_NUMBER GITHUB_RUN_NUMBER].each { |key| ENV[key] = saved[key] }
end
