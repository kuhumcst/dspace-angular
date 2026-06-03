import { TranslateLoader } from '@ngx-translate/core';
import { Observable, of as observableOf } from 'rxjs';
import { existsSync, readFileSync } from 'fs';
import { TransferState } from '@angular/platform-browser';
import { NGX_TRANSLATE_STATE, NgxTranslateState } from './ngx-translate-state';

/**
 * A TranslateLoader for ngx-translate to parse json5 files server-side, and store them in the
 * TransferState.
 *
 * Loads the base catalogue and the theme overlay, merges them (overlay wins), and stores the
 * result in TransferState so the browser receives the already-merged translations without an
 * extra HTTP request.
 */
export class TranslateServerLoader implements TranslateLoader {

  constructor(
    protected transferState: TransferState,
    protected prefix: string = 'dist/assets/i18n/',
    protected suffix: string = '.json'
  ) {
  }

  public getTranslation(lang: string): Observable<any> {
    const translationHash: string = (process.env.languageHashes as any)[lang + '.json5'];
    const base = JSON.parse(readFileSync(`${this.prefix}${lang}.${translationHash}${this.suffix}`, 'utf8'));

    // Theme overlay lives alongside the base assets: assets/custom/i18n/{lang}.json.
    // Derive the path by replacing the i18n directory segment in the prefix.
    const overlayPath = `${this.prefix.replace(/i18n\/$/, 'custom/i18n/')}${lang}.json`;
    const overlay = existsSync(overlayPath) ? JSON.parse(readFileSync(overlayPath, 'utf8')) : {};

    const messages = Object.assign({}, base, overlay);
    this.storeInTransferState(lang, messages);
    return observableOf(messages);
  }

  protected storeInTransferState(lang: string, messages) {
    const prevState = this.transferState.get<NgxTranslateState>(NGX_TRANSLATE_STATE, {});
    const nextState = Object.assign({}, prevState, {
      [lang]: messages
    });
    this.transferState.set(NGX_TRANSLATE_STATE, nextState);
  }
}
