-- ============================================================
-- Comentários opcionais das seções "Comida" e "Ambiente e agilidade"
-- ============================================================

ALTER TABLE salao_evaluations ADD COLUMN food_comment TEXT;
ALTER TABLE salao_evaluations ADD COLUMN ambience_comment TEXT;

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
    return_intent, best_aspects, improvement_comment, comment, client_name, client_phone,
    client_birthdate, food_comment, ambience_comment
  ) VALUES (
    v_session_id, v_unit_id, v_waiter_id, v_table_id,
    (payload->>'overall_score')::SMALLINT,
    (payload->>'nps_score')::SMALLINT,
    (payload->>'return_intent')::salao_return_intent,
    COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(payload->'best_aspects') x), '{}'),
    NULLIF(payload->>'improvement_comment', ''),
    NULLIF(payload->>'comment', ''),
    NULLIF(payload->>'client_name', ''),
    NULLIF(payload->>'client_phone', ''),
    NULLIF(payload->>'client_birthdate', '')::DATE,
    NULLIF(payload->>'food_comment', ''),
    NULLIF(payload->>'ambience_comment', '')
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
