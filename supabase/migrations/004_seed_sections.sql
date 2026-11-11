-- ============================================================================
-- AES CareOffice — Phase 2 Migration 004: Seed Grade Sections
-- Migrated directly from config/sections.json
-- ============================================================================

INSERT INTO public.grade_sections (grade_level, section_name)
VALUES
    ('Kindergarten', 'Platinum'),
    ('Kindergarten', 'Silver'),
    ('Grade 1', 'Crystal'),
    ('Grade 1', 'Diamond'),
    ('Grade 1', 'Opal'),
    ('Grade 1', 'Sapphire'),
    ('Grade 2', 'Rainstone'),
    ('Grade 2', 'Turquoise'),
    ('Grade 2', 'Tourmaline'),
    ('Grade 2', 'Carnelian'),
    ('Grade 3', 'Opalite'),
    ('Grade 3', 'Jade'),
    ('Grade 3', 'Sunstone'),
    ('Grade 3', 'Tanzanite'),
    ('Grade 4', 'Alexandrite'),
    ('Grade 4', 'Fluorite'),
    ('Grade 4', 'Rose Quartz'),
    ('Grade 4', 'Zircon'),
    ('Grade 5', 'Emerald'),
    ('Grade 5', 'Morganite'),
    ('Grade 5', 'Ruby'),
    ('Grade 5', 'Topaz'),
    ('Grade 6', 'Amethyst'),
    ('Grade 6', 'Garnet'),
    ('Grade 6', 'Moonstone'),
    ('Grade 6', 'Pearl')
ON CONFLICT (grade_level, lower(section_name)) DO NOTHING;

