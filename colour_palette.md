# Teal-Based Web Application Color System

## 1. Brand Colors

| Token | HEX | Usage |
|---|---|---|
| Primary Teal | #006D6F | Primary buttons, links, active states |
| Primary Dark | #004D4D | Sidebar, hover states |
| Light Teal | #E6F4F1 | Selected items, information panels |
| Classic Teal | #008080 | Secondary brand accents |
| Pastel Teal | #B2DFDB | Decorative highlights |

## 2. Background Colors

| Token | HEX | Usage |
|---|---|---|
| App Background | #F8FAFC | Main application background |
| Surface | #FFFFFF | Cards, forms, dialogs |
| Active Background | #DDF2ED | Selected navigation items |
| Subtle Background | #F1F5F9 | Secondary sections |

## 3. Typography Colors

| Token | HEX | Usage |
|---|---|---|
| Primary Text | #172B3A | Headings and body text |
| Secondary Text | #64748B | Descriptions and metadata |
| Text on Primary | #FFFFFF | Text on dark teal buttons |
| Muted Text | #94A3B8 | Low-emphasis labels |

## 4. Borders

| Token | HEX | Usage |
|---|---|---|
| Default Border | #DCE5E8 | Cards and inputs |
| Strong Border | #CBD5E1 | Emphasized boundaries |
| Focus Ring | #0E7490 | Keyboard focus indicators |

## 5. Complementary Accent Colors

| Color | HEX | Usage |
|---|---|---|
| Warm Amber | #F59E0B | Highlights and attention |
| Coral | #E76F51 | Promotional accents |
| Indigo | #4F46E5 | Secondary actions and charts |
| Sky Blue | #0EA5E9 | Information and data visualization |

## 6. Semantic Status Colors

| Status | Foreground | Background | Usage |
|---|---|---|---|
| Success | #15803D | #DCFCE7 | Completed actions |
| Warning | #B45309 | #FEF3C7 | Pending actions |
| Error | #B91C1C | #FEE2E2 | Errors and failures |
| Information | #0369A1 | #E0F2FE | Informational messages |

## 7. UI Component Mapping

| Component | Color |
|---|---|
| App background | #F8FAFC |
| Card background | #FFFFFF |
| Sidebar | #004D4D |
| Primary button | #006D6F |
| Primary button hover | #004D4D |
| Active navigation background | #DDF2ED |
| Main text | #172B3A |
| Secondary text | #64748B |
| Input border | #DCE5E8 |
| Primary link | #006D6F |
| Highlight | #F59E0B |

## 8. CSS Design Tokens

```css
:root {
  /* Brand */
  --color-primary: #006D6F;
  --color-primary-hover: #004D4D;
  --color-primary-light: #E6F4F1;
  --color-primary-soft: #DDF2ED;

  /* Backgrounds */
  --color-background: #F8FAFC;
  --color-surface: #FFFFFF;
  --color-surface-muted: #F1F5F9;
  --color-sidebar: #004D4D;

  /* Typography */
  --color-text: #172B3A;
  --color-text-secondary: #64748B;
  --color-text-muted: #94A3B8;
  --color-text-on-primary: #FFFFFF;

  /* Borders and focus */
  --color-border: #DCE5E8;
  --color-border-strong: #CBD5E1;
  --focus-ring: #0E7490;

  /* Accents */
  --color-accent: #F59E0B;
  --color-accent-coral: #E76F51;
  --color-accent-indigo: #4F46E5;
  --color-accent-blue: #0EA5E9;

  /* Status */
  --color-success: #15803D;
  --color-success-bg: #DCFCE7;
  --color-warning: #B45309;
  --color-warning-bg: #FEF3C7;
  --color-error: #B91C1C;
  --color-error-bg: #FEE2E2;
  --color-info: #0369A1;
  --color-info-bg: #E0F2FE;
}
```

## 9. Recommended Usage Ratio

- 60% neutral backgrounds: white and cool off-white.
- 30% brand colors: teal, dark teal, and pale teal.
- 10% accents: amber, coral, indigo, and status colors.

Treat this as a flexible guideline rather than a strict requirement.

## 10. Accessibility Guidelines

- Use white text on deep teal for primary buttons.
- Use dark navy text on pale teal backgrounds.
- Avoid white text on light teal or amber backgrounds.
- Verify text and background pairs against WCAG contrast requirements.
- Aim for at least 4.5:1 contrast for normal text and 3:1 for large text.
- Do not communicate status through color alone; include icons or labels.
- Provide visible keyboard focus indicators.
- Check hover, disabled, error, and focus states separately.

## 11. Design Recommendation

Use deep teal as the primary brand color, cool white for the main background, white for cards, deep navy for text, and warm amber for selective highlights. Reserve coral and indigo for secondary accents to keep the interface cohesive.

Suitable for SaaS dashboards, admin panels, CRM applications, e-commerce platforms, and business web applications.