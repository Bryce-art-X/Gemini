class_name UITheme
extends RefCounted


static func make_font() -> Font:
	var sys := SystemFont.new()
	sys.font_names = PackedStringArray([
		"Microsoft YaHei UI",
		"Microsoft YaHei",
		"PingFang SC",
		"Noto Sans CJK SC",
		"SimHei",
		"Arial",
	])
	sys.antialiasing = TextServer.FONT_ANTIALIASING_LCD
	return sys


static func make_theme() -> Theme:
	var theme := Theme.new()
	theme.default_font = make_font()
	theme.default_font_size = 20
	return theme


static func style_button(btn: Button, bg: Color, text_col: Color = Color(0.07, 0.07, 0.1)) -> void:
	var normal := StyleBoxFlat.new()
	normal.bg_color = bg
	normal.border_color = Color(0.067, 0.067, 0.086)
	normal.set_border_width_all(4)
	normal.set_corner_radius_all(16)
	normal.shadow_color = Color(0.067, 0.067, 0.086, 0.85)
	normal.shadow_size = 0
	normal.shadow_offset = Vector2(0, 6)
	normal.set_content_margin_all(12)

	var hover := normal.duplicate()
	hover.bg_color = bg.lightened(0.14)

	var pressed := normal.duplicate()
	pressed.bg_color = bg.darkened(0.08)
	pressed.shadow_offset = Vector2(0, 1)

	btn.add_theme_stylebox_override("normal", normal)
	btn.add_theme_stylebox_override("hover", hover)
	btn.add_theme_stylebox_override("pressed", pressed)
	btn.add_theme_stylebox_override("focus", hover)
	btn.add_theme_color_override("font_color", text_col)
	btn.add_theme_color_override("font_hover_color", text_col)
	btn.add_theme_color_override("font_pressed_color", text_col)


static func style_card(panel: PanelContainer, bg: Color, border: Color = Color(0.067, 0.067, 0.086)) -> void:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = border
	sb.set_border_width_all(4)
	sb.set_corner_radius_all(20)
	sb.shadow_color = Color(0.05, 0.05, 0.08, 0.65)
	sb.shadow_offset = Vector2(0, 8)
	sb.set_content_margin_all(24)
	panel.add_theme_stylebox_override("panel", sb)
