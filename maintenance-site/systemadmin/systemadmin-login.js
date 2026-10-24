// Public System Admin form: show why the browser prevented submission.
// No password reads, fetch, storage, logging, or authentication logic.
const form=document.querySelector('.admin-login-form');
const feedback=document.getElementById('admin-login-validation');
if(form&&feedback){
  function show(message){
    feedback.textContent=message;
    feedback.hidden=false;
  }
  form.addEventListener('invalid',event=>{
    const field=event.target;
    if(field!==form.querySelector(':invalid'))return;
    if(field.name==='username'){
      show(field.validity.valueMissing?'Wpisz login administratora.':
        'Login musi mieć 3–32 znaki: litery, cyfry, kropka, myślnik lub podkreślenie.');
    }else if(field.name==='password'){
      show(field.validity.valueMissing?'Wpisz hasło administratora.':
        'Hasło musi zawierać co najmniej 9 znaków.');
    }
  },true);
  form.addEventListener('input',()=>{feedback.hidden=true;});
  form.addEventListener('submit',()=>{
    show('Sprawdzanie danych logowania…');
    // Keep the native HTTPS POST; do not disable the submit button.
  });
}
