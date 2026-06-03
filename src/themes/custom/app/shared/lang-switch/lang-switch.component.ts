import { Component } from '@angular/core';
import { LangSwitchComponent as BaseComponent } from '../../../../../app/shared/lang-switch/lang-switch.component';

@Component({
  selector: 'ds-lang-switch',
  styleUrls: ['./lang-switch.component.scss'],
  templateUrl: './lang-switch.component.html',
})
export class LangSwitchComponent extends BaseComponent {

  getFlagCode(lang: string): string {
    const flagMap: { [key: string]: string } = {
      en: 'gb',
      da: 'dk',
    };
    return flagMap[lang] || lang;
  }

}
