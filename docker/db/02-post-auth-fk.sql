-- Rodar manualmente UMA VEZ, depois que a stack completa subir pela
-- primeira vez num deploy do zero (depois que fotosaas-auth cria
-- auth.users). Nao e montado em docker-entrypoint-initdb.d porque nesse
-- momento do boot o schema auth ainda nao existe.
--
-- docker exec fotosaas-db psql -U postgres -d postgres -f /caminho/deste/arquivo.sql

ALTER TABLE ONLY public.essay_reviews
  ADD CONSTRAINT essay_reviews_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.users(id);

NOTIFY pgrst, 'reload schema';
