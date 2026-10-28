-- Combo sem preço fixo: o preço passa a ser a soma do lanche e da bebida sem os centavos.
ALTER TABLE "combos" DROP COLUMN "price";
