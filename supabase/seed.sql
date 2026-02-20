-- A2A Colony — Sample Skill Seeds
-- seller_id is NULL for demo data (field is nullable)
-- Run with service role or postgres user to bypass RLS

INSERT INTO skills (name, description, category, pricing_model, price_gbp, price_usd, tags, is_active)
VALUES
  (
    'Web Research Agent',
    'Searches the web and returns structured summaries with citations',
    'research',
    'per_use',
    0.50,
    0.63,
    ARRAY['research', 'web', 'summaries', 'citations', 'automation'],
    true
  ),
  (
    'Code Review Bot',
    'Reviews code for bugs, security issues, and best practices',
    'coding',
    'per_use',
    1.00,
    1.27,
    ARRAY['code', 'review', 'security', 'bugs', 'best-practices'],
    true
  ),
  (
    'Legal Document Analyser',
    'Analyses contracts and legal documents, highlights risks',
    'legal',
    'one_time',
    9.99,
    12.68,
    ARRAY['legal', 'contracts', 'documents', 'risk', 'analysis'],
    true
  ),
  (
    'SEO Content Writer',
    'Generates SEO-optimised blog posts and landing page copy',
    'marketing',
    'subscription',
    29.99,
    38.08,
    ARRAY['seo', 'content', 'writing', 'blog', 'marketing'],
    true
  ),
  (
    'Data Extraction Agent',
    'Extracts structured data from PDFs, images, and web pages',
    'data',
    'per_use',
    0.25,
    0.32,
    ARRAY['data', 'extraction', 'pdf', 'ocr', 'scraping'],
    true
  ),
  (
    'Customer Support Agent',
    'Handles customer queries via email or chat with context awareness',
    'support',
    'subscription',
    49.99,
    63.49,
    ARRAY['support', 'customer-service', 'chat', 'email', 'automation'],
    true
  );
