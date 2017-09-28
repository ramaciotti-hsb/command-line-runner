const spawn = require('child_process').spawn

// On document ready
document.addEventListener("DOMContentLoaded", () => {
    let commandInput = document.querySelector('.command-input')
    let submitButton = document.querySelector('.submit-button')

    submitButton.addEventListener('click', () => {
        const split = commandInput.value.split(' ')
        const command = spawn(split[0], split.slice(1))
        
        command.stdout.on( 'data', data => {
            console.log( `stdout: ${data}` );
        });

        command.stderr.on( 'data', data => {
            console.log( `stderr: ${data}` );
        });

        command.on( 'close', code => {
            console.log( `child process exited with code ${code}` );
        });
    })
})