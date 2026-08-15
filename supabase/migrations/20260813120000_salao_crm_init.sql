-- ============================================================
-- MATRUS · CRM DE EXPERIÊNCIA DO SALÃO
-- Todas as tabelas usam o prefixo salao_ para nunca colidir com
-- o schema do projeto matros-ops que compartilha este banco.
-- Requer Postgres 13+ (gen_random_uuid nativo, sem extensões extras).
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE salao_user_role AS ENUM ('admin', 'gerente', 'garcom');
CREATE TYPE salao_return_intent AS ENUM ('certamente', 'provavelmente', 'talvez', 'provavelmente_nao', 'nao_voltaria');
CREATE TYPE salao_alert_type AS ENUM ('negativo', 'positivo');
CREATE TYPE salao_alert_status AS ENUM ('novo', 'em_analise', 'resolvido', 'ignorado');
CREATE TYPE salao_category_group AS ENUM ('atendimento', 'comida', 'ambiente', 'operacao');

-- ============================================================
-- UNIDADES (preparado para multi-unidade futura)
-- ============================================================

CREATE TABLE salao_units (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- USUÁRIOS DO PAINEL (vinculados a auth.users)
-- ============================================================

CREATE TABLE salao_users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  unit_id     UUID REFERENCES salao_units(id) ON DELETE SET NULL,
  waiter_id   UUID, -- FK adicionada após criação de salao_waiters
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  role        salao_user_role NOT NULL DEFAULT 'gerente',
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- GARÇONS
-- ============================================================

CREATE TABLE salao_waiters (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id     UUID NOT NULL REFERENCES salao_units(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  photo_url   TEXT,
  phone       TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE salao_users ADD CONSTRAINT salao_users_waiter_fk
  FOREIGN KEY (waiter_id) REFERENCES salao_waiters(id) ON DELETE SET NULL;

-- ============================================================
-- MESAS (preparado para QR Code por mesa - Modelo B)
-- ============================================================

CREATE TABLE salao_tables (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id     UUID NOT NULL REFERENCES salao_units(id) ON DELETE CASCADE,
  number      INTEGER NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (unit_id, number)
);

-- ============================================================
-- QR CODES (token opaco, sem dados pessoais)
-- ============================================================

CREATE TABLE salao_qr_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waiter_id   UUID REFERENCES salao_waiters(id) ON DELETE CASCADE,
  table_id    UUID REFERENCES salao_tables(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE DEFAULT (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  regenerated_at TIMESTAMPTZ,
  CHECK (waiter_id IS NOT NULL OR table_id IS NOT NULL)
);

CREATE UNIQUE INDEX idx_salao_qr_codes_waiter_active ON salao_qr_codes(waiter_id) WHERE active AND waiter_id IS NOT NULL;

-- ============================================================
-- SESSÕES DE ATENDIMENTO (aberta ao escanear o QR)
-- ============================================================

CREATE TABLE salao_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id     UUID NOT NULL REFERENCES salao_units(id) ON DELETE CASCADE,
  waiter_id   UUID REFERENCES salao_waiters(id) ON DELETE SET NULL,
  table_id    UUID REFERENCES salao_tables(id) ON DELETE SET NULL,
  qr_code_id  UUID NOT NULL REFERENCES salao_qr_codes(id) ON DELETE CASCADE,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================================
-- AVALIAÇÕES
-- ============================================================

CREATE TABLE salao_evaluations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID NOT NULL REFERENCES salao_sessions(id) ON DELETE CASCADE,
  unit_id             UUID NOT NULL REFERENCES salao_units(id) ON DELETE CASCADE,
  waiter_id           UUID REFERENCES salao_waiters(id) ON DELETE SET NULL,
  table_id            UUID REFERENCES salao_tables(id) ON DELETE SET NULL,
  overall_score       SMALLINT NOT NULL CHECK (overall_score BETWEEN 1 AND 5),
  nps_score           SMALLINT NOT NULL CHECK (nps_score BETWEEN 0 AND 10),
  return_intent       salao_return_intent NOT NULL,
  best_aspects        TEXT[] NOT NULL DEFAULT '{}',
  improvement_comment TEXT,
  comment             TEXT,
  client_name         TEXT,
  client_phone        TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- NOTAS POR CATEGORIA (atendimento / comida / ambiente / operação)
-- ============================================================

CREATE TABLE salao_evaluation_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES salao_evaluations(id) ON DELETE CASCADE,
  category_group salao_category_group NOT NULL,
  category      TEXT NOT NULL,
  score         SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment       TEXT
);

-- ============================================================
-- ALERTAS (ocorrências negativas e destaques positivos)
-- ============================================================

CREATE TABLE salao_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id   UUID NOT NULL REFERENCES salao_evaluations(id) ON DELETE CASCADE,
  type            salao_alert_type NOT NULL,
  status          salao_alert_status NOT NULL DEFAULT 'novo',
  reason          TEXT NOT NULL,
  internal_note   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID REFERENCES salao_users(id)
);

-- ============================================================
-- CONFIGURAÇÕES (chave/valor)
-- ============================================================

CREATE TABLE salao_settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ANTI-FRAUDE — controle de envios repetidos por QR/dispositivo
-- ============================================================

CREATE TABLE salao_rate_limits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code_id    UUID NOT NULL REFERENCES salao_qr_codes(id) ON DELETE CASCADE,
  fingerprint   TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_salao_rate_limits_lookup ON salao_rate_limits(qr_code_id, fingerprint, created_at);

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX idx_salao_waiters_unit          ON salao_waiters(unit_id);
CREATE INDEX idx_salao_tables_unit           ON salao_tables(unit_id);
CREATE INDEX idx_salao_qr_codes_token        ON salao_qr_codes(token);
CREATE INDEX idx_salao_sessions_waiter       ON salao_sessions(waiter_id);
CREATE INDEX idx_salao_evaluations_unit      ON salao_evaluations(unit_id);
CREATE INDEX idx_salao_evaluations_waiter    ON salao_evaluations(waiter_id);
CREATE INDEX idx_salao_evaluations_created   ON salao_evaluations(created_at);
CREATE INDEX idx_salao_eval_categories_eval  ON salao_evaluation_categories(evaluation_id);
CREATE INDEX idx_salao_alerts_status         ON salao_alerts(status);
CREATE INDEX idx_salao_alerts_type           ON salao_alerts(type);

-- ============================================================
-- TRIGGERS — updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION salao_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_salao_waiters_updated BEFORE UPDATE ON salao_waiters
  FOR EACH ROW EXECUTE FUNCTION salao_update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE salao_units                ENABLE ROW LEVEL SECURITY;
ALTER TABLE salao_users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE salao_waiters              ENABLE ROW LEVEL SECURITY;
ALTER TABLE salao_tables               ENABLE ROW LEVEL SECURITY;
ALTER TABLE salao_qr_codes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE salao_sessions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE salao_evaluations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE salao_evaluation_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE salao_alerts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE salao_settings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE salao_rate_limits          ENABLE ROW LEVEL SECURITY;

-- Nota: não há policy pública de SELECT/INSERT para o fluxo anônimo do QR Code.
-- O cliente acessa dados de contexto via a função SECURITY DEFINER
-- get_salao_qr_context() e envia a avaliação via a API route do Next.js,
-- que usa a service role key (mesmo padrão do matros-ops).

CREATE OR REPLACE FUNCTION salao_current_role()
RETURNS salao_user_role AS $$
  SELECT role FROM salao_users WHERE id = auth.uid() AND active = TRUE;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION salao_current_waiter_id()
RETURNS UUID AS $$
  SELECT waiter_id FROM salao_users WHERE id = auth.uid() AND active = TRUE;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION salao_is_staff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM salao_users WHERE id = auth.uid() AND active = TRUE);
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE POLICY "staff_select_units" ON salao_units
  FOR SELECT USING (salao_is_staff());
CREATE POLICY "admin_write_units" ON salao_units
  FOR ALL USING (salao_current_role() = 'admin');

CREATE POLICY "self_select_users" ON salao_users
  FOR SELECT USING (id = auth.uid() OR salao_current_role() IN ('admin', 'gerente'));
CREATE POLICY "admin_write_users" ON salao_users
  FOR ALL USING (salao_current_role() = 'admin');

CREATE POLICY "staff_select_waiters" ON salao_waiters
  FOR SELECT USING (
    salao_current_role() IN ('admin', 'gerente')
    OR id = salao_current_waiter_id()
  );
CREATE POLICY "manager_write_waiters" ON salao_waiters
  FOR ALL USING (salao_current_role() IN ('admin', 'gerente'));

CREATE POLICY "staff_select_tables" ON salao_tables
  FOR SELECT USING (salao_is_staff());
CREATE POLICY "manager_write_tables" ON salao_tables
  FOR ALL USING (salao_current_role() IN ('admin', 'gerente'));

CREATE POLICY "manager_all_qr_codes" ON salao_qr_codes
  FOR ALL USING (salao_current_role() IN ('admin', 'gerente'));

CREATE POLICY "staff_select_sessions" ON salao_sessions
  FOR SELECT USING (salao_current_role() IN ('admin', 'gerente'));

CREATE POLICY "staff_select_evaluations" ON salao_evaluations
  FOR SELECT USING (
    salao_current_role() IN ('admin', 'gerente')
    OR waiter_id = salao_current_waiter_id()
  );

CREATE POLICY "staff_select_eval_categories" ON salao_evaluation_categories
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM salao_evaluations e
      WHERE e.id = evaluation_id
      AND (salao_current_role() IN ('admin', 'gerente') OR e.waiter_id = salao_current_waiter_id())
    )
  );

CREATE POLICY "manager_all_alerts" ON salao_alerts
  FOR ALL USING (salao_current_role() IN ('admin', 'gerente'));

CREATE POLICY "staff_select_settings" ON salao_settings
  FOR SELECT USING (salao_is_staff());
CREATE POLICY "admin_write_settings" ON salao_settings
  FOR ALL USING (salao_current_role() = 'admin');

CREATE POLICY "manager_select_rate_limits" ON salao_rate_limits
  FOR SELECT USING (salao_current_role() IN ('admin', 'gerente'));

-- ============================================================
-- FUNÇÃO PÚBLICA — contexto do QR Code (sem expor policies públicas)
-- ============================================================

CREATE OR REPLACE FUNCTION get_salao_qr_context(p_token TEXT)
RETURNS JSON AS $$
  SELECT json_build_object(
    'qr_code_id', q.id,
    'unit', json_build_object('id', u.id, 'name', u.name),
    'waiter', CASE WHEN w.id IS NOT NULL THEN json_build_object('id', w.id, 'name', w.name, 'photo_url', w.photo_url) ELSE NULL END,
    'table', CASE WHEN t.id IS NOT NULL THEN json_build_object('id', t.id, 'number', t.number) ELSE NULL END
  )
  FROM salao_qr_codes q
  JOIN salao_units u ON u.id = COALESCE(
    (SELECT unit_id FROM salao_waiters WHERE id = q.waiter_id),
    (SELECT unit_id FROM salao_tables WHERE id = q.table_id)
  )
  LEFT JOIN salao_waiters w ON w.id = q.waiter_id AND w.active = TRUE
  LEFT JOIN salao_tables t ON t.id = q.table_id AND t.active = TRUE
  WHERE q.token = p_token AND q.active = TRUE AND u.active = TRUE;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION get_salao_qr_context(TEXT) TO anon, authenticated;

-- ============================================================
-- FUNÇÃO PÚBLICA — configurações expostas ao cliente (Google, textos)
-- ============================================================

CREATE OR REPLACE FUNCTION get_salao_public_settings()
RETURNS JSON AS $$
  SELECT json_object_agg(key, value)
  FROM salao_settings
  WHERE key IN ('company_name', 'logo_url', 'primary_color', 'google_review_link', 'thank_you_message');
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION get_salao_public_settings() TO anon, authenticated;

-- ============================================================
-- RPC — envio atômico de avaliação (evaluation + categories + alert)
-- ============================================================

CREATE OR REPLACE FUNCTION submit_salao_evaluation(payload JSONB)
RETURNS UUID AS $$
DECLARE
  v_session_id UUID;
  v_unit_id UUID;
  v_waiter_id UUID;
  v_table_id UUID;
  v_evaluation_id UUID;
  v_min_category SMALLINT;
  v_category JSONB;
  v_reasons TEXT[] := '{}';
  v_threshold SMALLINT;
BEGIN
  v_session_id := (payload->>'session_id')::UUID;

  SELECT unit_id, waiter_id, table_id INTO v_unit_id, v_waiter_id, v_table_id
  FROM salao_sessions WHERE id = v_session_id;

  IF v_unit_id IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;

  INSERT INTO salao_evaluations (
    session_id, unit_id, waiter_id, table_id, overall_score, nps_score,
    return_intent, best_aspects, improvement_comment, comment, client_name, client_phone
  ) VALUES (
    v_session_id, v_unit_id, v_waiter_id, v_table_id,
    (payload->>'overall_score')::SMALLINT,
    (payload->>'nps_score')::SMALLINT,
    (payload->>'return_intent')::salao_return_intent,
    COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(payload->'best_aspects') x), '{}'),
    NULLIF(payload->>'improvement_comment', ''),
    NULLIF(payload->>'comment', ''),
    NULLIF(payload->>'client_name', ''),
    NULLIF(payload->>'client_phone', '')
  ) RETURNING id INTO v_evaluation_id;

  v_min_category := 5;
  FOR v_category IN SELECT * FROM jsonb_array_elements(payload->'categories')
  LOOP
    INSERT INTO salao_evaluation_categories (evaluation_id, category_group, category, score, comment)
    VALUES (
      v_evaluation_id,
      (v_category->>'group')::salao_category_group,
      v_category->>'category',
      (v_category->>'score')::SMALLINT,
      NULLIF(v_category->>'comment', '')
    );
    IF (v_category->>'score')::SMALLINT < v_min_category THEN
      v_min_category := (v_category->>'score')::SMALLINT;
    END IF;
  END LOOP;

  UPDATE salao_sessions SET completed_at = NOW() WHERE id = v_session_id;

  SELECT COALESCE((value #>> '{}')::SMALLINT, 3) INTO v_threshold
  FROM salao_settings WHERE key = 'alert_score_threshold';
  v_threshold := COALESCE(v_threshold, 3);

  IF (payload->>'overall_score')::SMALLINT <= v_threshold THEN
    v_reasons := array_append(v_reasons, 'Nota geral baixa');
  END IF;
  IF v_min_category <= v_threshold THEN
    v_reasons := array_append(v_reasons, 'Categoria avaliada abaixo do esperado');
  END IF;
  IF (payload->>'return_intent') IN ('provavelmente_nao', 'nao_voltaria') THEN
    v_reasons := array_append(v_reasons, 'Baixa intenção de retorno');
  END IF;

  IF array_length(v_reasons, 1) > 0 THEN
    INSERT INTO salao_alerts (evaluation_id, type, reason)
    VALUES (v_evaluation_id, 'negativo', array_to_string(v_reasons, '; '));
  ELSIF (payload->>'overall_score')::SMALLINT = 5 AND v_min_category >= 5 THEN
    INSERT INTO salao_alerts (evaluation_id, type, status, reason)
    VALUES (v_evaluation_id, 'positivo', 'resolvido', 'Experiência 5 estrelas');
  END IF;

  RETURN v_evaluation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revoga o EXECUTE público padrão: sem isso, qualquer usuário anon/authenticated
-- poderia chamar a função diretamente via RPC com um session_id válido e burlar
-- o rate limiting, que só existe na API route do Next.js.
REVOKE EXECUTE ON FUNCTION submit_salao_evaluation(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_salao_evaluation(JSONB) TO service_role;

-- ============================================================
-- VIEW — ranking de garçons (com limiar mínimo de avaliações)
-- ============================================================

CREATE OR REPLACE VIEW vw_salao_waiter_ranking WITH (security_invoker = true) AS
SELECT
  w.id AS waiter_id,
  w.unit_id,
  w.name,
  w.photo_url,
  w.active,
  COUNT(e.id) AS total_evaluations,
  ROUND(AVG(e.overall_score), 2) AS avg_overall,
  ROUND(AVG(e.nps_score), 2) AS avg_nps_score,
  COUNT(e.id) FILTER (WHERE e.nps_score >= 9) AS promoters,
  COUNT(e.id) FILTER (WHERE e.nps_score <= 6) AS detractors,
  CASE WHEN COUNT(e.id) > 0 THEN
    ROUND(
      (COUNT(e.id) FILTER (WHERE e.nps_score >= 9)::NUMERIC - COUNT(e.id) FILTER (WHERE e.nps_score <= 6)::NUMERIC)
      / COUNT(e.id) * 100, 1)
  ELSE NULL END AS nps,
  COUNT(e.id) FILTER (WHERE e.overall_score = 5) AS five_star_count,
  CASE WHEN COUNT(e.id) > 0 THEN
    ROUND(COUNT(e.id) FILTER (WHERE e.overall_score = 5)::NUMERIC / COUNT(e.id) * 100, 1)
  ELSE NULL END AS five_star_pct,
  COUNT(a.id) FILTER (WHERE a.type = 'negativo') AS complaint_count
FROM salao_waiters w
LEFT JOIN salao_evaluations e ON e.waiter_id = w.id
LEFT JOIN salao_alerts a ON a.evaluation_id = e.id
GROUP BY w.id, w.unit_id, w.name, w.photo_url, w.active;

-- ============================================================
-- VIEW — KPIs diários do dashboard
-- ============================================================

CREATE OR REPLACE VIEW vw_salao_dashboard_daily WITH (security_invoker = true) AS
SELECT
  e.unit_id,
  e.created_at::date AS day,
  COUNT(*) AS total_evaluations,
  ROUND(AVG(e.overall_score), 2) AS avg_overall,
  ROUND(AVG(e.nps_score), 2) AS avg_nps_score,
  COUNT(*) FILTER (WHERE e.nps_score >= 9) AS promoters,
  COUNT(*) FILTER (WHERE e.nps_score <= 6) AS detractors,
  COUNT(*) FILTER (WHERE e.return_intent IN ('certamente', 'provavelmente')) AS likely_to_return,
  COUNT(*) FILTER (WHERE e.overall_score <= 3) AS negative_count
FROM salao_evaluations e
GROUP BY e.unit_id, e.created_at::date;

-- ============================================================
-- CONFIGURAÇÕES PADRÃO
-- ============================================================

INSERT INTO salao_settings (key, value) VALUES
  ('company_name', '"Matrus"'),
  ('logo_url', 'null'),
  ('primary_color', '"#f97316"'),
  ('google_review_link', 'null'),
  ('thank_you_message', '"Obrigado por compartilhar sua experiência! Sua opinião ajuda nossa equipe a melhorar todos os dias."'),
  ('alert_score_threshold', '3'),
  ('min_evaluations_for_ranking', '5')
ON CONFLICT (key) DO NOTHING;
