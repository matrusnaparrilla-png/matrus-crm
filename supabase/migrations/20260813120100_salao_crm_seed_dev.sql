-- ============================================================
-- SEED DE DESENVOLVIMENTO — MATRUS CRM
-- Execute apenas em ambiente de desenvolvimento/teste.
-- Cria 1 unidade, 5 garçons (com QR Code), 10 mesas (com QR Code)
-- e ~50 avaliações distribuídas em diferentes dias/horários/notas.
-- ============================================================

DO $$
DECLARE
  v_unit_id UUID;
  v_waiter_ids UUID[];
  v_table_ids UUID[];
  v_qr_id UUID;
  v_session_id UUID;
  v_i INT;
  v_waiter UUID;
  v_table UUID;
  v_overall SMALLINT;
  v_nps SMALLINT;
  v_return TEXT;
  v_days_ago INT;
  v_hour INT;
  v_created TIMESTAMPTZ;
BEGIN
  INSERT INTO salao_units (name, slug) VALUES ('Matrus Parrilla', 'matrus-parrilla')
  RETURNING id INTO v_unit_id;

  v_waiter_ids := ARRAY[]::UUID[];
  FOR v_i IN 1..5 LOOP
    DECLARE v_w UUID; v_name TEXT;
    BEGIN
      v_name := (ARRAY['Lucas', 'Ana', 'Nicolas', 'Beatriz', 'Rafael'])[v_i];
      INSERT INTO salao_waiters (unit_id, name) VALUES (v_unit_id, v_name) RETURNING id INTO v_w;
      INSERT INTO salao_qr_codes (waiter_id) VALUES (v_w);
      v_waiter_ids := array_append(v_waiter_ids, v_w);
    END;
  END LOOP;

  v_table_ids := ARRAY[]::UUID[];
  FOR v_i IN 1..10 LOOP
    DECLARE v_t UUID;
    BEGIN
      INSERT INTO salao_tables (unit_id, number) VALUES (v_unit_id, v_i) RETURNING id INTO v_t;
      INSERT INTO salao_qr_codes (table_id) VALUES (v_t);
      v_table_ids := array_append(v_table_ids, v_t);
    END;
  END LOOP;

  FOR v_i IN 1..50 LOOP
    v_waiter := v_waiter_ids[1 + floor(random() * array_length(v_waiter_ids, 1))::int];
    v_table := v_table_ids[1 + floor(random() * array_length(v_table_ids, 1))::int];
    v_days_ago := floor(random() * 45)::int;
    v_hour := 11 + floor(random() * 12)::int;
    v_created := (CURRENT_DATE - v_days_ago) + (v_hour || ' hours')::interval + (floor(random()*60) || ' minutes')::interval;

    -- distribuição: ~65% positivas, ~20% neutras, ~15% negativas
    IF v_i % 20 < 13 THEN
      v_overall := 4 + (v_i % 2);
      v_nps := 9 + (v_i % 2);
      v_return := 'certamente';
    ELSIF v_i % 20 < 17 THEN
      v_overall := 3;
      v_nps := 7;
      v_return := 'provavelmente';
    ELSE
      v_overall := 1 + (v_i % 2);
      v_nps := (v_i % 5);
      v_return := CASE WHEN v_i % 2 = 0 THEN 'provavelmente_nao' ELSE 'nao_voltaria' END;
    END IF;

    SELECT id INTO v_qr_id FROM salao_qr_codes WHERE waiter_id = v_waiter LIMIT 1;

    INSERT INTO salao_sessions (unit_id, waiter_id, table_id, qr_code_id, started_at, completed_at)
    VALUES (v_unit_id, v_waiter, v_table, v_qr_id, v_created, v_created)
    RETURNING id INTO v_session_id;

    INSERT INTO salao_evaluations (
      session_id, unit_id, waiter_id, table_id, overall_score, nps_score, return_intent,
      best_aspects, comment, created_at
    ) VALUES (
      v_session_id, v_unit_id, v_waiter, v_table, v_overall, v_nps, v_return::salao_return_intent,
      ARRAY['atendimento', 'comida'],
      CASE WHEN v_overall <= 2 THEN 'Demorou muito para o pedido chegar.' WHEN v_overall = 5 THEN 'Experiência excelente, com certeza voltarei!' ELSE NULL END,
      v_created
    );

    DECLARE v_eval_id UUID;
    BEGIN
      SELECT id INTO v_eval_id FROM salao_evaluations WHERE session_id = v_session_id;

      INSERT INTO salao_evaluation_categories (evaluation_id, category_group, category, score)
      SELECT
        v_eval_id,
        cat.group_name::salao_category_group,
        cat.key,
        GREATEST(1, LEAST(5, v_overall + (floor(random()*3)::int - 1)))
      FROM (VALUES
        ('atendimento','cordialidade'), ('atendimento','agilidade'), ('atendimento','atencao'),
        ('atendimento','conhecimento_cardapio'), ('atendimento','simpatia'),
        ('comida','sabor'), ('comida','apresentacao'), ('comida','temperatura'), ('comida','qualidade_percebida'),
        ('ambiente','limpeza'), ('ambiente','organizacao'), ('ambiente','conforto'), ('ambiente','musica'), ('ambiente','ambiente_geral'),
        ('operacao','tempo_pedido'), ('operacao','tempo_pratos'), ('operacao','organizacao_salao')
      ) AS cat(group_name, key);

      IF v_overall <= 3 OR v_return IN ('provavelmente_nao', 'nao_voltaria') THEN
        INSERT INTO salao_alerts (evaluation_id, type, reason, created_at)
        VALUES (v_eval_id, 'negativo', 'Nota geral baixa ou baixa intenção de retorno (dado de teste)', v_created);
      ELSIF v_overall = 5 THEN
        INSERT INTO salao_alerts (evaluation_id, type, status, reason, created_at)
        VALUES (v_eval_id, 'positivo', 'resolvido', 'Experiência 5 estrelas (dado de teste)', v_created);
      END IF;
    END;
  END LOOP;
END $$;
