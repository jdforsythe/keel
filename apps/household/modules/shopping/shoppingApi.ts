import { service } from "@keel/services";
import { shopping } from "./shopping.contract.ts";

export const shoppingApi = service({ contract: shopping });
